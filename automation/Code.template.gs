/* RealeCall lead intake. Copy Code.gs into the lead spreadsheet's Apps Script project.
 * Configure SPREADSHEET_ID and WEBHOOK_SECRET in Script Properties before deployment.
 * No email or outreach is sent by this script. */
function onOpen() {
 SpreadsheetApp.getUi().createMenu('RealeCall').addItem('Set up lead sheet','setupRealeCall').addItem('Refresh qualification formulas','refreshQualification').addItem('Sort leads by priority','sortByPriority').addToUi();
}
function getLeadSheet_() {
 var properties=PropertiesService.getScriptProperties();
 var id=properties.getProperty('SPREADSHEET_ID') || DEFAULT_SPREADSHEET_ID;
 if (!id) throw new Error('Configure SPREADSHEET_ID in Script Properties.');
 var sheet=SpreadsheetApp.openById(id).getSheetByName('Leads');
 if (!sheet) throw new Error('The Leads tab is missing.');
 var headers=sheet.getRange(1,1,1,HEADERS.length).getValues()[0];
 if (JSON.stringify(headers)!==JSON.stringify(HEADERS)) throw new Error('Lead headers differ. Restore the expected columns before connecting.');
 return sheet;
}
function setupRealeCall() {
 var sheet=getLeadSheet_();sheet.setFrozenRows(1);sheet.setFrozenColumns(2);
 Object.keys(LEAD_OPTIONS).forEach(function(col){sheet.getRange(col+'2:'+col+Math.max(102,sheet.getLastRow())).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(LEAD_OPTIONS[col],true).setAllowInvalid(false).build());});
 refreshQualification();
 return 'Lead sheet ready. Configure WEBHOOK_SECRET and deploy a web app before connecting the website.';
}
function safeCell_(value) {
 if (value===undefined||value===null)return '';
 var s=String(value);return /^[\s]*[=+\-@]/.test(s)?"'"+s:s;
}
function validLead_(d) {
 if(!d||!/^[-0-9a-f]{36}$/i.test(d.requestId)||d.consent!==true||!d.name||!d.company||!d.message||String(d.message).length<10)return false;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email))return false;
 if(!Array.isArray(d.services)||d.services.length<1||d.services.length>4||d.services.some(function(x){return SERVICES.indexOf(x)===-1;}))return false;
 if(LEAD_OPTIONS.L.indexOf(d.agents)<0||LEAD_OPTIONS.N.indexOf(d.start)<0||LEAD_OPTIONS.O.indexOf(d.duration)<0||LEAD_OPTIONS.P.indexOf(d.budgetStatus)<0||LEAD_OPTIONS.R.indexOf(d.role)<0||LEAD_OPTIONS.S.indexOf(d.intent)<0||LEAD_OPTIONS.J.indexOf(d.mode)<0)return false;
 if(['Phone','WhatsApp'].indexOf(d.mode)>=0&&!/^\+?[\d\s().-]{7,30}$/.test(d.phone||''))return false;
 if(d.intent==='discovery'&&(!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!d.timeWindow))return false;
 return !d.websiteCheck;
}
function doGet(){return json_({ok:true,service:'RealeCall lead intake'});}
function doPost(e) {
 var lock=LockService.getScriptLock();
 try {
  if(!e||!e.postData||e.postData.contents.length>18000)return json_({ok:false,error:'Invalid request'});
  var body=JSON.parse(e.postData.contents);var secret=PropertiesService.getScriptProperties().getProperty('WEBHOOK_SECRET');
  if(!secret||secret.length<32||body.secret!==secret)return json_({ok:false,error:'Unauthorized'});
  var d=body.lead;if(!validLead_(d))return json_({ok:false,error:'Invalid inquiry'});
  lock.waitLock(10000);var sheet=getLeadSheet_();
  var last=Math.max(sheet.getLastRow(),2);var ids=sheet.getRange(2,1,last-1,1).getValues();
  for(var i=0;i<ids.length;i++)if(String(ids[i][0])===d.requestId)return json_({ok:true,duplicate:true,id:d.requestId});
  var row=last+1;for(var j=0;j<ids.length;j++)if(!ids[j][0]){row=j+2;break;}
  if(row>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),100);
  var values=[d.requestId,new Date(d.createdAt||new Date().toISOString()),'','','','New',d.company,d.name,d.email,d.mode,d.phone||'',d.agents,d.services.join(', '),d.start,d.duration,d.budgetStatus,d.budget||'',d.role,d.intent,d.date||'',d.timeWindow||'',d.timezone,d.website||'',d.industry||'',d.message,'','','',d.variant||'',''];
  values=values.map(function(v){return v instanceof Date?v:safeCell_(v);});
  sheet.getRange(row,1,1,HEADERS.length).setValues([values]);
  var f=sheetFormulas(row);Object.keys(f).forEach(function(col){sheet.getRange(col+row).setFormula(f[col]);});
  sheet.getRange(row,2).setNumberFormat('yyyy-mm-dd hh:mm');sheet.getRange(row,5).setNumberFormat('0');sheet.getRange(row,11).setNumberFormat('@');
  Object.keys(LEAD_OPTIONS).forEach(function(col){sheet.getRange(col+row).setDataValidation(SpreadsheetApp.newDataValidation().requireValueInList(LEAD_OPTIONS[col],true).setAllowInvalid(false).build());});
  SpreadsheetApp.flush();
  return json_({ok:true,id:d.requestId});
 } catch(err){return json_({ok:false,error:'Lead could not be accepted. It remains queued in the website.'});}
 finally{if(lock.hasLock())lock.releaseLock();}
}
function refreshQualification(){var sheet=getLeadSheet_();var last=Math.max(sheet.getLastRow(),2);for(var r=2;r<=last;r++){var f=sheetFormulas(r);Object.keys(f).forEach(function(col){sheet.getRange(col+r).setFormula(f[col]);});}SpreadsheetApp.flush();}
function sortByPriority(){var sheet=getLeadSheet_();var ids=sheet.getRange(2,1,Math.max(1,sheet.getLastRow()-1),1).getValues();var last=1;ids.forEach(function(r,i){if(r[0])last=i+2;});if(last>2){sheet.getRange(2,1,last-1,HEADERS.length).sort([{column:4,ascending:true},{column:3,ascending:true},{column:5,ascending:false},{column:2,ascending:true}]);refreshQualification();}}
function json_(data){return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);}
