// Global variables
var database;			// CSV file, all data points
var labels;				// Image labels in CSV, eg bottlenecks/Clothes/Tops/checkshirts0.jpg.txt
var docNum;				// Number of images in database
var attriNum;			// Number of attributes in database
var queryLabel;			// Image label of query in database
var queryIndex;			// Index of query in database
var queryVector;		// Vector of query
var idfTable;			// Generated once during saveData
var tfIdfTable;			// Generated once during saveData
var kSimTable;
var classifier;			// Either Tops/Bottoms/Shoes
var date;
var datepre;
var championsTable;

//get excel database
function readCSV(evt) {

	datepre = new Date();
	document.getElementById("errorMessage").style.display = "none";
	var file = evt.target.files[0];

	var name = file.name
	if(name.includes("tops")){
		classifier = "Tops";
	}else if(name.includes("bottoms")){
		classifier = "Bottoms";
	}else if(name.includes("shoes")){
		classifier = "Shoes";
	}



    Papa.parse(file, {
        headers: true,
        download: true,
        dynamicTyping: true,
        complete: function(results) {
            saveData(results.data);
        }
    });
};

// Passed and called as callback function in readCSV
function saveData(data) {
    database = data;

    database.splice(0,1); 					// Remove headers
    database.splice(database.length-1,1); 	// Remove end of blanks

    labels = extractLabels();

    var dimensions = [ database.length, database[0].length ];
	docNum = dimensions[0];
	attriNum = dimensions[1];

	console.log("docNum");
	console.log(docNum);
	console.log("attriNum");
	console.log(attriNum);

	// Compute tf-idf table once
	idfTable = computeIdf(database);
	tfIdfTable = computeTfIdf(database, idfTable);
	datepre = datepre - new Date();
	console.log("datepre");
	console.log(datepre);

	// Create champions table
	championsTable = [];
	for (var i = 0; i < attriNum; i++){
		championsTable.push(getChampionList(tfIdfTable, i));
	}
	console.log("championsTable");
	console.log(championsTable);
};

function extractLabels(){
	var labels = [];
	for (var i = 0; i < database.length; i++){
		labels.push(database[i][0])			// Get labels
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

    var filePath = createPathToImage(file.name);
    document.getElementById("queryImage").src = filePath;

    queryLabel = createLabelFromImage(file.name);
    queryIndex = labels.indexOf(queryLabel);
    queryVector = database[queryIndex];

    retrieveSimilarClothing();
};

//query from backend will contain query vector and a classifier
function generateRandomQuery(){

	if (typeof database == 'undefined'){
		document.getElementById("errorMessage").style.display = 'block';
		return;
	}

	var i = randomIntFromInterval(0,docNum-1);
	var image = createImagefromLabel(labels[i]);
	if (!labels[i].includes("Unlabelled")){
		document.getElementById("queryImage").src = createPathToImage(image,1);
	}
	else {
		document.getElementById("queryImage").src = createPathToImage(image,0);
	}
	document.getElementById("queryLabel").innerHTML = labels[i];

	queryLabel = labels[i];
	queryIndex = i;
	queryVector = database[queryIndex];



	var confidentPositive = 0;
	var notConfident = 0;
	var confidentNegative = 0;


	for(var y = 0; y < attriNum; y++){ 

		if(queryVector[y]<=0.4){
			confidentNegative++;
		}
	
		else if(queryVector[y]<0.8){
			notConfident++;
		}

		else if(queryVector[y]>=0.8){
			confidentPositive++;
		}

	} 

	document.getElementById("confidence").innerHTML = confidentPositive + " " + notConfident + " " + confidentNegative;
	retrieveSimilarClothing();
	champions_retrieveSimilarClothing();
};

function retrieveSimilarClothing(){
	date = new Date();
	var queryTable = normalizeQuery(queryVector, idfTable);
	var k = 6;
	var index = selectBestK(queryTable, tfIdfTable, k);
	date = date - new Date();
	console.log("date");
	console.log(date);


	// Send results to front-end
	for (var i = 0; i < k; i++){
		document.getElementById("match-label-"+i).innerHTML = labels[index[i]] + " " + kSimTable[i];
	}

	for (var i = 0; i < k; i++){
		var image = createImagefromLabel(labels[index[i]])
		if (!labels[index[i]].includes("Unlabelled")){
			var imagePath = createPathToImage(image,1);
		}
		else {
			var imagePath = createPathToImage(image,0);
		} 
		
		document.getElementById("match-image-"+i).src = imagePath;
	}
};

// Champions Function: retrieveSimilarClothing from the championList
function champions_retrieveSimilarClothing(){

	var searchList = champions_getSearchList();		// Get the search list from the championsTable
	var queryTable = normalizeQuery(queryVector, idfTable);
	var k = 6;
	var index = champions_selectBestK(queryTable, tfIdfTable, k, searchList);
	console.log("Champions index");
	console.log(index);
	for (var i = 0; i < k; i++){
		var image = createImagefromLabel(labels[index[i]])
		if (!labels[index[i]].includes("Unlabelled")){
			var imagePath = createPathToImage(image,1);
		}
		else {
			var imagePath = createPathToImage(image,0);
		}

		document.getElementById("champions-match-image-"+i).src = imagePath;
	}

};

// Champions Function:  Gets the search list from championsTable according to queryVector
function champions_getSearchList(){
	var searchList = [];
	var listNum = championsTable[0].length;

	for (var i = 0; i < attriNum; i++){
		// Based on confidence of each attribute, get length of the championsList to use
		var cutoff = Math.ceil(listNum * queryVector[i]);
		searchList = arrayUnique( searchList.concat(championsTable[i].slice(0,cutoff)) );

	}
	return searchList;
};

// Cosine similarity functions
function computeIdf(database){
	// threshold can be changed

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

	var tfIdfTable = [];
	var magTable = [];
	for(var x = 0; x < docNum; x++){
		tfIdfTable[x] = [];    
		magTable[x]= 0;
		for(var y = 0; y < attriNum; y++){ 
			tfIdfTable[x][y] = (1+Math.log(1+database[x][y])) * idfTable[y]; //tf-idf

			//this part edits the importance of certain vectors
			//Decrease importance of no secondary colours
	        if(y == 32){ tfIdfTable[x][y] = tfIdfTable[x][y] * 0.1 }

	        // //Increase importance of primary colours
	        if(y < 16 ){ tfIdfTable[x][y] = tfIdfTable[x][y] * 3 }
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

	queryMag = Math.sqrt(queryMag);

	//Normalizing step
	for(var y = 0; y < attriNum; y++){ 
		queryTable[y] =  queryTable[y]/queryMag ;
	}   

	return queryTable;
};

// Compute cosine similarity between query and documents, select the top k results
function selectBestK(query, tfIdfTable, k){
	
	kSimTable = [];

	var cosSimTable = [];
	for(var x = 0; x < docNum; x++){
		cosSimTable[x]=0;
		for(var y = 0; y < attriNum; y++){ 
			cosSimTable[x] += query[y] * tfIdfTable[x][y];
		}    
	} 



	var index = [];
	while(index.length < k){
	//for each document, take the largest cossim and store the index
		var max_index = cosSimTable.indexOf(Math.max(...cosSimTable));
		if (max_index != queryIndex){	//should not return itself
			index.push(max_index);
			//log the cosine similarity of max_index into a global var to show later on
            kSimTable.push(cosSimTable[max_index]);}

		cosSimTable[max_index]=-1;		//remove largest value and iterate again
	}  



	return index;
};

// Champions Function: Compute cosine similarity between query and documents, select the top k results
function champions_selectBestK(query, tfIdfTable, k, searchList){

	var cosSimTable = [];
	for(var x = 0; x < searchList.length; x++){
		var docIndexToCompare = searchList[x];
		cosSimTable[x]=0;
		for(var y = 0; y < attriNum; y++){
			cosSimTable[x] += query[y] * tfIdfTable[docIndexToCompare][y];
		}
	}

	console.log("cosSimTable");
	console.log(cosSimTable);

	var index = [];
	while(index.length < k){
	//for each document, take the largest cossim and store the index
		var max_index_in_searchList = cosSimTable.indexOf(Math.max(...cosSimTable));
		var max_index = searchList[max_index_in_searchList];
		if (max_index != queryIndex){	//should not return itself
			index.push(max_index);
			//log the cosine similarity of max_index into a global var to show later on
            kSimTable.push(cosSimTable[max_index]);}

		cosSimTable[max_index_in_searchList]=-1;		//remove largest value and iterate again
	}

	return index;
};

// Extracts out champion list for each clothing attribute
function getChampionList(tfIdfTable, attriNumReferenced){

	if (attriNumReferenced > attriNum){
		console.log("ERROR: Exceeded attribute number");
		return 0;
	}
	var championListSize = 0.01;   				// size of champion list relative to size of corpus
	var k = Math.ceil(championListSize*docNum);
	var championList = [];
	var tfIdfColumn = [];
	for (var i = 0; i < docNum; i++){
		tfIdfColumn[i] = tfIdfTable[i][attriNumReferenced];
	}

	for (var j = 0; j < k; j++){
		var max_index = tfIdfColumn.indexOf(Math.max(...tfIdfColumn));
		championList[j] = max_index;
		tfIdfColumn[max_index]=-1;
	}
	return championList;
};

// ALL HELPER FUNCTIONS
function randomIntFromInterval(min,max)
{
    return Math.floor(Math.random()*(max-min+1)+min);
};

// eg: checkshirts0.jpg -> ir_corpus/Tops/checkshirts0.jpg
function createPathToImage(filename,labelled)
{	
	if (labelled){
		return "ir_corpus/labelled_clothes/" + classifier + "/"  + filename
	}
	else{
		return "ir_corpus/unlabelled_clothes/" + classifier + "/"  + filename
	}
};

// eg: checkshirts0.jpg -> bottlenecks/Clothes/Tops/checkshirts0.jpg.txt
function createLabelFromImage(filename)
{
	return "bottlenecks/Clothes/" + classifier + "/" + filename + ".txt"
};

// eg: bottlenecks/Clothes/Tops/checkshirts0.jpg.txt -> checkshirts0.jpg 
function createImagefromLabel(filename)
{
	var parts = filename.split("/");
	var image = parts[3];
	var partsAgain = image.split(".");

	return partsAgain[0]+"."+partsAgain[1]
};

function arrayUnique(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }
    return a;
};

// All event bindings
$(document).ready(function(){
	document.getElementById("csv-file").addEventListener("change",readCSV);
	document.getElementById("query-file").addEventListener("change",readQuery);
	document.getElementById("create-random-query").addEventListener("click",generateRandomQuery);
});

