const http = require("node:http");
const handleBackendRequest = require("./backend");

if (require.main === module)
  http
    .createServer(handleBackendRequest)
    .listen(Number(process.env.PORT) || 3000, "0.0.0.0", () =>
      console.log(
        `PromptDock API is running on port ${Number(process.env.PORT) || 3000}`,
      ),
    );

module.exports = handleBackendRequest;
