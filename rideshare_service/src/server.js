/*
This code starts the Express server and makes the application listen for incoming 
API requests on the configured port. It also displays a message in the console when 
the server starts successfully.
*/

const app = require('./app');
const { port } = require('./config/env');

app.listen(port, () => console.log(`rideshare_service running on port ${port}`));