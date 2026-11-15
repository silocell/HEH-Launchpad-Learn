/* =====================================================================
   geo-facts.js - the geography facts, in one place, for Map Quest and
   for the flash cards' daily questions. Every fact checked by hand.
   [place, answer, the wrong answer people usually give (optional)]
   GPL-3.0.
   ===================================================================== */
(function(){
var EUROPE = [
  ["France","Paris"],["Germany","Berlin"],["Spain","Madrid","Barcelona"],["Italy","Rome","Milan"],
  ["Portugal","Lisbon","Porto"],["the Netherlands","Amsterdam","Rotterdam"],["Belgium","Brussels"],
  ["Ireland","Dublin","Belfast"],["Poland","Warsaw","Kraków"],["Greece","Athens"],["Austria","Vienna"],
  ["Switzerland","Bern","Zürich"],["Sweden","Stockholm"],["Norway","Oslo"],["Denmark","Copenhagen"],
  ["Finland","Helsinki"],["the Czech Republic","Prague"],["Hungary","Budapest"],["Romania","Bucharest"],
  ["Ukraine","Kyiv"],["Croatia","Zagreb"],["Iceland","Reykjavík"]
];
var WORLD = [
  ["Japan","Tokyo","Kyoto"],["China","Beijing","Shanghai"],["India","New Delhi","Mumbai"],
  ["the USA","Washington, D.C.","New York"],["Canada","Ottawa","Toronto"],["Australia","Canberra","Sydney"],
  ["Brazil","Brasília","Rio de Janeiro"],["Argentina","Buenos Aires"],["Egypt","Cairo"],["Kenya","Nairobi"],
  ["Nigeria","Abuja","Lagos"],["Mexico","Mexico City"],["Russia","Moscow"],["Turkey","Ankara","Istanbul"],
  ["South Korea","Seoul"],["New Zealand","Wellington","Auckland"],["Peru","Lima"],["Ghana","Accra"],
  ["Pakistan","Islamabad","Karachi"],["Morocco","Rabat","Casablanca"],["Chile","Santiago"],["Thailand","Bangkok"]
];
var CONTINENT = [
  ["Kenya","Africa"],["Egypt","Africa"],["Nigeria","Africa"],["Brazil","South America"],["Argentina","South America"],
  ["Peru","South America"],["Japan","Asia"],["India","Asia"],["China","Asia"],["Canada","North America"],
  ["Mexico","North America"],["Poland","Europe"],["Portugal","Europe"],["New Zealand","Oceania"],["Fiji","Oceania"]
];
var CONTINENTS = ["Africa","Antarctica","Asia","Europe","North America","Oceania","South America"];
var OCEANS = ["Pacific","Atlantic","Indian","Southern","Arctic"];
window.GEO_FACTS = { EUROPE: EUROPE, WORLD: WORLD, CONTINENT: CONTINENT, CONTINENTS: CONTINENTS, OCEANS: OCEANS };
})();
