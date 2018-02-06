function doPost(e){
  getLogger().log("doPost() triggered by %s with command '%s'", e.parameter["user_name"], e.parameter["text"]);
  var commandReceived = e.parameter["text"];

  if (commandReceived.match(/help/)) showHelp();
  if (commandReceived.match(/list/)) listStaging();
  if (commandReceived.match(/take/)) take(e);
  if (commandReceived.match(/leave/)) leave(e);
  if (commandReceived.match(/create/)) create(e);
  if (commandReceived.match(/remove/)) remove(e);
  if (commandReceived.match(/rename/)) rename(e);
}

function listStaging(){
  getLogger().log("listing staging servers");

  var sheet = getStatusSheet();
  var lastRow = sheet.getLastRow();

  if (lastRow > 1) {
    var range = "A2:D" + lastRow;
    var values = sheet.getRange(range).getValues();
    var lines = [];

    for (var i = 0; i < values.length; i++){
      lines.push(
        buildStagingListLine(values[i])
      );
    }

    sendMessage(lines.join("\n"));
  }else{
    sendMessage("There isn't any staging server added.");
  }
}

function showHelp(){
  getLogger().log("showing help");

  var message = "*Available commands:*\n\n";
  message += "- *help*: What you see here.\n";
  message += "- *list*: Will show the list of staging servers and their current state\n";
  message += "- *take <server_name>*: Will mark the server as busy by the author of the command.\n";
  message += "- *leave <server_name>*: Will free the server.\n";
  message += "- *create <server_name>*: Will create a new server.\n";
  message += "- *delete <server_name>*: Will remove an existing server.\n";
  message += "- *rename <current_server_name> <new_server_name>*: Will rename a server.\n";

  sendMessage(message);
}

function take(e){
  var currentOwner = e.parameter["user_name"];
  var messageReceived = e.parameter["text"].trim();
  var regex = /take ([a-zA-Z0-9-_]+)( (.*))?/;
  var matches = regex.exec(messageReceived);
  var serverName = matches[1];
  var reason = matches[3] ? matches[3] : "Not specified";
  var sheet = getStatusSheet();
  var affectedRow = getServerRow(serverName);

  if (affectedRow) {
    sheet.getRange("B" + affectedRow).setValue(true);
    sheet.getRange("C" + affectedRow).setValue(currentOwner);
    sheet.getRange("D" + affectedRow).setValue(reason);

    getLogger().log("%s took staging server %s. Reason: %s", currentOwner, serverName, reason);

    listStaging();
  } else {
    sendMessage("*" + serverName + "* server not found");
  }
}

function leave(e){
  var releaser = e.parameter["user_name"];
  var messageReceived = e.parameter["text"].trim();
  var regex = /leave ([a-zA-Z0-9-_]+)/;
  var matches = regex.exec(messageReceived);
  var serverName = matches[1];
  var sheet = getStatusSheet();
  var affectedRow = getServerRow(serverName);

  if (affectedRow) {
    sheet.getRange("B" + affectedRow).setValue(false);
    sheet.getRange("C" + affectedRow).setValue("");
    sheet.getRange("D" + affectedRow).setValue("");

    getLogger().log("%s released staging server %s", releaser, serverName);

    listStaging();
  } else {
    sendMessage("*" + serverName + "* server not found");
  }
}

function create(e){
  var creator = e.parameter["user_name"];
  var messageReceived = e.parameter["text"].trim();
  var regex = /create ([a-zA-Z0-9-_]+)/;
  var matches = regex.exec(messageReceived);
  var serverName = matches[1];
  var sheet = getStatusSheet();
  var lastRow = sheet.getLastRow();

  // Check there isn't a server with the same name already.
  // TODO

  // Set the name of the server in a new row.
  sheet.getRange("A" + (lastRow+1)).setValue(serverName);
  sheet.getRange("B" + (lastRow+1)).setValue(false);

  getLogger().log("%s created staging server %s", creator, serverName);

  // Send confirmation to the channel
  sendMessage("Server *" + serverName + "* was successfully added.");
}

function remove(e){
  var remover = e.parameter["user_name"];
  var messageReceived = e.parameter["text"].trim();
  var regex = /remove ([a-zA-Z0-9-_]+)/;
  var matches = regex.exec(messageReceived);
  var serverName = matches[1];
  var sheet = getStatusSheet();
  var affectedRow = getServerRow(serverName);

  if (affectedRow) {
    sheet.deleteRow(affectedRow);
    getLogger().log("%s deleted staging server %s", remover, serverName);
    listStaging();
  } else {
    sendMessage("*" + serverName + "* server not found");
  }
}

function rename(e){
  var renamer = e.parameter["user_name"];
  var messageReceived = e.parameter["text"].trim();
  var regex = /rename ([a-zA-Z0-9-_]+) ([a-zA-Z0-9-_]+)/;
  var matches = regex.exec(messageReceived);
  var currentServerName = matches[1];
  var newServerName = matches[2];
  var sheet = getStatusSheet();
  var affectedRow = getServerRow(currentServerName);

  if (affectedRow) {
    sheet.getRange("A" + affectedRow).setValue(newServerName);
    getLogger().log("%s renamed staging server %s to %s", renamer, currentServerName, newServerName);
    listStaging();
  } else {
    sendMessage("*" + currentServerName + "* server not found");
  }
}

function getStatusSheet(){
  return SpreadsheetApp.openById(getProperty("SPREADSHEET_ID")).getSheetByName("Status");
}

function buildStagingListLine(row){
  var line = "";

  if(row[1] == true){
    line += ":lock: " + row[0] + " (Taken by: " + row[2] + ") (Reason: " + row[3] + ")";
  }else{
    line += ":white_check_mark: " + row[0];
  }

  return line;
}

function sendMessage(message){
  var payload = {
    "channel": "#" + getProperty("SLACK_CHANNEL_NAME"),
    "username": "Staging Status",
    "icon_emoji": ":robot_face:",
    "text": message
  };

  var url = getProperty("SLACK_INCOMING_WEBHOOK");
  var options = {
    'method': 'post',
    'payload': JSON.stringify(payload)
  };

  var response = UrlFetchApp.fetch(url, options);
}

function getLogger(){
  return BetterLog.useSpreadsheet(getProperty("SPREADSHEET_ID"));
}

function getProperty(propertyName){
  return PropertiesService.getScriptProperties().getProperty(propertyName);
}

function getServerRow(serverName){
  var sheet = getStatusSheet();
  var dataRange = sheet.getDataRange();
  var values = dataRange.getValues();
  var outRow = null;

  for (var i = 0; i < values.length; i++)
  {
    if (values[i][0] == serverName)
    {
      outRow = i+1;
      break;
    }
  }

  return outRow;
}
