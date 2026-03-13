The tool is a chrome extention designed to gather data from Ivanti Neurons MDM when an agents opens a user profile and selects his device in order to complete a template form in ServiceNOW at https://rtxprod.servicenowservices.com/ using the details gathered.
Form Template: 
Name:
Email:
Callback:
ADX: 
Corp/BYOD: Corp
Device Model:
Serial number: 
MDN: 
iOS Version:
Issue / Error message: 
Troubleshoot:
Escalated: Yes/No
Example completed form for user with employee ID: E10940165 - Jaspal Minhas:
Name: Jaspal Minhas
Email: Jaspal.Minhas@collins.com
Callback: 6477631081
ADX: E10940165
Corp/BYOD: Corp
Device Model: iPhone 12 
Serial number: H4YJ82YB0F00
MDN: +12892188428
iOS Version: 26.3.1
Issue / Error message: The user called in because his company phone is no longer turning on
Troubleshoot:
Escalated: Yes/No

The user name, callback and employee ID, as well as "Issue / Error message" can be taken from the "Description" field on the same ServiceNOW page as the agents will manually add those details when the case is created.
Agents will open the employee profile in Ivanti Go and click on his device, from where the extension can gather the other required details and complete the form that agents will copy-paste in the "Work Notes" field in ServiceNow.

The extension will be built using Typescript, Javascript, CSS and JSON
