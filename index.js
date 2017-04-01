// Global variables
var database;
var labels;
var docNum;
var attriNum;
var queryLabel;
var queryIndex;
var queryVector;

function readCSV(evt) {
	document.getElementById("errorMessage").style.display = "none";
	var file = evt.target.files[0];
    Papa.parse(file, {
        headers: true,
        download: true,
        dynamicTyping: true,
        complete: function(results) {
            saveData(results.data);
        }
    });
};

// Called after reading CSV
function saveData(data) {
    database = data;

    database.splice(0,1); 					// Remove headers
    database.splice(database.length-1,1); 	// Remove end of blanks

    labels = extractLabels();
	docNum = database.length;
	attriNum = database[0].length;
};

function extractLabels(){
	var labels = [];
	for (var i = 0; i < database.length; i++){
		labels.push(database[i][0])			// Get label
		database[i].splice(0,1);			// Remove it from database
	}
	return labels
};

function readQuery(evt) {
	if (typeof database == 'undefined'){
		document.getElementById("errorMessage").style.display = 'block';
		return;
	}

	var file = evt.target.files[0];
    console.log(file);
    var filePath = createPathToImage(file.name);
    document.getElementById("queryImage").src = filePath;

    queryLabel = createLabelFromImage(file.name);
    queryIndex = labels.indexOf(queryLabel);
    queryVector = database[queryIndex];

    retrieveSimilarClothing();
};

function generateRandomQuery(){
	if (typeof database == 'undefined'){
		document.getElementById("errorMessage").style.display = 'block';
		return;
	}

	var i = randomIntFromInterval(0,docNum-1);
	var image = createImagefromLabel(labels[i]);
	document.getElementById("queryImage").src = createPathToImage(image);

	queryLabel = labels[i];
	queryIndex = i;
	queryVector = database[queryIndex];

	retrieveSimilarClothing();
};

function retrieveSimilarClothing(){
	var idfTable = computeIdf(database);

	var tfIdfTable = computeTfIdf(database, idfTable);

	var queryTable = normalizeQuery(queryVector, idfTable);
	var k = 3;
	var index = selectBestK(queryTable, tfIdfTable, k);
	console.log(index);

	// Send results to front-end
	for (var i = 0; i < k; i++){
		document.getElementById("match-label-"+i).innerHTML = labels[index[i]];
	}

	for (var i = 0; i < k; i++){
		var image = createImagefromLabel(labels[index[i]])
		var imagePath = createPathToImage(image);
		document.getElementById("match-image-"+i).src = imagePath;
	}
};

// Cosine similarity functions
function computeIdf(database){
	// threshold can be changed
	var dimensions = [ database.length, database[0].length ];
	var docNum = dimensions[0];
	var attriNum = dimensions[1];

	var idfTable = [];
	var threshold = 0.7; // Used as a threshold to consider as inside document

	for(var y = 0; y < attriNum; y++){ 
		var docf =0;
		for(var x = 0; x < docNum; x++){
			if (database[x][y] > threshold){
				docf += 1;
			}		
		} 
		var idf = Math.log(docNum/docf); //note log is natural logarithm

		//if frequency 0, unable to give relavant doc, set idf = 0 instead of infinity
		if (docf ==0){ idf = 0;}
		idfTable[y] = 1 + idf;  //CHANGE if necessary
	}
	return idfTable;
};

// Calculate tfid and magnitudes of each doc, obtain normalized tfIdfTable
function computeTfIdf(database, idfTable){
	var dimensions = [ database.length, database[0].length ];
	var docNum = dimensions[0];
	var attriNum = dimensions[1];

	var tfIdfTable = [];
	var magTable = [];
	for(var x = 0; x < docNum; x++){
		tfIdfTable[x] = [];    
		magTable[x]= 0;
		for(var y = 0; y < attriNum; y++){ 
			tfIdfTable[x][y] = (1+Math.log(1+database[x][y])) * idfTable[y]; //tf-idf
			magTable[x] += tfIdfTable[x][y]* tfIdfTable[x][y];
		}    
	}

	//normalising step
	for(var x = 0; x < docNum; x++){
		magTable[x] = Math.sqrt(magTable[x]);
		for(var y = 0; y < attriNum; y++){ 
			tfIdfTable[x][y] =  tfIdfTable[x][y]/magTable[x] ;
		}
	}
	return tfIdfTable;
};

function normalizeQuery(query, idfTable){
	var attriNum = idfTable.length;

	var queryMag = 0;
	var queryTable = [];

	for(var y = 0; y < attriNum; y++){ 
		queryTable[y] = query[y]*idfTable[y];  
		queryMag += queryTable[y]* queryTable[y];
	}  
	console.log(queryTable); 
	queryMag = Math.sqrt(queryMag);

	//Normalizing step
	for(var y = 0; y < attriNum; y++){ 
		queryTable[y] =  queryTable[y]/queryMag ;
	}   

	return queryTable;
};

// Compute cosine similarity between query and documents, select the top k results
function selectBestK(query, tfIdfTable, k){
	var dimensions = [ tfIdfTable.length, tfIdfTable[0].length ];
	var docNum = dimensions[0];
	var attriNum = dimensions[1];

	var cosSimTable = [];
	for(var x = 0; x < docNum; x++){
		cosSimTable[x]=0;
		for(var y = 0; y < attriNum; y++){ 
			cosSimTable[x] += query[y] * tfIdfTable[x][y];
		}    
	} 

	console.log("cosSimTable");
	console.log(cosSimTable);

	var index = [];
	while(index.length < 3){
	//for each document, take the largest cossim and store the index
		var max_index = cosSimTable.indexOf(Math.max(...cosSimTable));
		if (max_index != queryIndex)	//should not return itself
			index.push(max_index);
		cosSimTable[max_index]=-1;		//remove largest value and iterate again
	}  
	return index;
};

// Helper functions
function randomIntFromInterval(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
};

// eg: checkshirts0.jpg -> ir_corpus/Tops/checkshirts0.jpg
function createPathToImage(filename)
{
	return "ir_corpus/Tops/" + filename
};

// eg: checkshirts0.jpg -> bottlenecks/Clothes/Tops/checkshirts0.jpg.txt
function createLabelFromImage(filename)
{
	return "bottlenecks/Clothes/Tops/" + filename + ".txt"
};

// eg: bottlenecks/Clothes/Tops/checkshirts0.jpg.txt -> checkshirts0.jpg 
function createImagefromLabel(filename)
{
	var parts = filename.split("/");
	var image = parts[3];
	var partsAgain = image.split(".");

	return partsAgain[0]+"."+partsAgain[1]
};

// All event bindings
$(document).ready(function(){
	document.getElementById("csv-file").addEventListener("change",readCSV);
	document.getElementById("query-file").addEventListener("change",readQuery);
	document.getElementById("create-random-query").addEventListener("click",generateRandomQuery);
});

