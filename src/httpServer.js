// This module starts the HTTP server, parses the request and calls the requested endpoint

const jsl = require("svjsl");
const http = require("http");
const rateLimit = require("http-ratelimit");
const Readable = require("stream").Readable;
const fs = require("fs");

const settings = require("../settings");
const debug = require("./verboseLogging");
const resolveIP = require("./resolveIP");
const logger = require("./logger");
const logRequest = require("./logRequest");
const convertFileFormat = require("./fileFormatConverter");
const parseURL = require("./parseURL");
const lists = require("./lists");
const analytics = require("./analytics");
const jokeSubmission = require("./jokeSubmission");
const auth = require("./auth");


const init = () => {
    debug("HTTP", "Starting HTTP server...");
    return new Promise((resolve, reject) => {
        let endpoints = [];

        /**
         * Initializes the HTTP server - should only be called once
         */
        let initHttpServer = () => {
            let httpServer = http.createServer((req, res) => {
                let parsedURL = parseURL(req.url);
                let ip = resolveIP(req);
                let hasHeaderAuth = auth.authByHeader(req);
                let analyticsObject = {
                    ipAddress: ip,
                    urlPath: parsedURL.pathArray,
                    urlParameters: parsedURL.queryParams
                };

                debug("HTTP", `Incoming ${req.method} request from "${ip.substring(0, 8)}..."`);
                
                let fileFormat = settings.jokes.defaultFileFormat.fileFormat;
                if(!jsl.isEmpty(parsedURL.queryParams) && !jsl.isEmpty(parsedURL.queryParams.format))
                    fileFormat = parseURL.getFileFormatFromQString(parsedURL.queryParams);

                try
                {
                    if(lists.isBlacklisted(ip))
                    {
                        logRequest("blacklisted", null, analyticsObject);
                        return respondWithError(res, 103, 403, fileFormat);
                    }

                    debug("HTTP", `URL obj is:\n${JSON.stringify(parsedURL, null, 4)}`);

                    if(settings.httpServer.allowCORS)
                    {
                        try
                        {
                            res.setHeader("Access-Control-Allow-Origin", "*");
                            res.setHeader("Access-Control-Request-Method", "GET");
                            res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
                            res.setHeader("Access-Control-Allow-Headers", "*");
                        }
                        catch(err)
                        {
                            console.log(`${jsl.colors.fg.red}Error while setting up CORS headers: ${err}${jsl.colors.rst}`);
                        }
                    }

                    res.setHeader("Allow", "GET, HEAD, OPTIONS");

                    if(settings.httpServer.infoHeaders)
                        res.setHeader("API-Info", `${settings.info.name} v${settings.info.version} (${settings.info.docsURL})`);
                }
                catch(err)
                {
                    if(jsl.isEmpty(fileFormat))
                    {
                        fileFormat = settings.jokes.defaultFileFormat.fileFormat;
                        if(!jsl.isEmpty(parsedURL.queryParams) && !jsl.isEmpty(parsedURL.queryParams.format))
                            fileFormat = parseURL.getFileFormatFromQString(parsedURL.queryParams);
                    }

                    analytics({
                        type: "Error",
                        data: {
                            errorMessage: `Error while setting up the HTTP response to "${ip.substr(8)}...": ${err}`,
                            ipAddress: ip,
                            urlParameters: parsedURL.queryParams,
                            urlPath: parsedURL.pathArray
                        }
                    });
                    return respondWithError(res, 500, 100, fileFormat, err);
                }

                //#SECTION GET
                if(req.method === "GET")
                {
                    //#MARKER GET
                    if(parsedURL.error === null)
                    {
                        let urlPath = parsedURL.pathArray;
                        let requestedEndpoint = "";
                        let lowerCaseEndpoints = [];
                        endpoints.forEach(ep => lowerCaseEndpoints.push(ep.name.toLowerCase()));

                        if(!jsl.isEmpty(urlPath))
                            requestedEndpoint = urlPath[0];
                        else
                        {
                            if(rateLimit.isRateLimited(req, settings.httpServer.rateLimiting) && !lists.isWhitelisted(ip) && !hasHeaderAuth)
                            {
                                analytics.rateLimited(ip);
                                logRequest("ratelimited", `IP: ${ip}`, analyticsObject);
                                return respondWithError(res, 101, 429, fileFormat);
                            }
                            else return serveDocumentation(req, res);
                            //else return respondWithErrorPage(req, res, 500, fileFormat, "Example Error @ex@");
                        }

                        // Disable caching now that the request is not a docs request
                        if(settings.httpServer.disableCache)
                        {
                            res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate, no-transform");
                            res.setHeader("Pragma", "no-cache");
                            res.setHeader("Expires", "0");
                        }

                        // serve favicon:
                        if(!jsl.isEmpty(parsedURL.pathArray) && parsedURL.pathArray[0] == "favicon.ico")
                            return pipeFile(res, settings.documentation.faviconPath, "image/x-icon", 200);

                        let foundEndpoint = false;
                        endpoints.forEach(ep => {
                            if(ep.name == requestedEndpoint)
                            {
                                let authHeaderObj = auth.authByHeader(req);
                                let hasHeaderAuth = authHeaderObj.isAuthorized;
                                let headerToken = authHeaderObj.token;

                                // now that the request is not a docs / favicon request, the blacklist is checked and the request is made eligible for rate limiting
                                if(!settings.endpoints.ratelimitBlacklist.includes(ep.name) && !hasHeaderAuth)
                                    rateLimit.inboundRequest(req);
                                
                                if(hasHeaderAuth)
                                {
                                    debug("HTTP", `Requester has valid token ${jsl.colors.fg.green}${req.headers[settings.auth.tokenHeaderName] || null}${jsl.colors.rst}`);
                                    analytics({
                                        type: "AuthTokenIncluded",
                                        data: {
                                            ipAddress: ip,
                                            urlParameters: parsedURL.queryParams,
                                            urlPath: parsedURL.pathArray,
                                            submission: headerToken
                                        }
                                    });
                                }

                                foundEndpoint = true;

                                let callEndpoint = require(`.${ep.absPath}`);
                                let meta = callEndpoint.meta;
                                
                                if(!jsl.isEmpty(meta) && meta.skipRateLimitCheck === true)
                                {
                                    try
                                    {
                                        if(jsl.isEmpty(meta) || (!jsl.isEmpty(meta) && meta.noLog !== true))
                                        {
                                            if(!lists.isConsoleBlacklisted(ip))
                                                logRequest("success", null, analyticsObject);
                                        }
                                        return callEndpoint.call(req, res, parsedURL.pathArray, parsedURL.queryParams, fileFormat);
                                    }
                                    catch(err)
                                    {
                                        return respondWithError(res, 104, 500, fileFormat);
                                    }
                                }
                                else
                                {
                                    if(rateLimit.isRateLimited(req, settings.httpServer.rateLimiting) && !lists.isWhitelisted(ip) && !hasHeaderAuth)
                                    {
                                        logRequest("ratelimited", `IP: ${ip}`, analyticsObject);
                                        return respondWithError(res, 101, 429, fileFormat);
                                    }
                                    else
                                    {
                                        if(jsl.isEmpty(meta) || (!jsl.isEmpty(meta) && meta.noLog !== true))
                                        {
                                            if(!lists.isConsoleBlacklisted(ip))
                                                logRequest("success", null, analyticsObject);
                                        }
                                            
                                        return callEndpoint.call(req, res, parsedURL.pathArray, parsedURL.queryParams, fileFormat);
                                    }
                                }
                            }
                        });

                        if(!foundEndpoint)
                        {
                            if(!jsl.isEmpty(fileFormat) && req.url.toLowerCase().includes("format"))
                                return respondWithError(res, 102, 404, fileFormat, `Endpoint "${!jsl.isEmpty(requestedEndpoint) ? requestedEndpoint : "/"}" not found - Please read the documentation at ${settings.info.docsURL}#endpoints to see all available endpoints`);
                            else return respondWithErrorPage(req, res, 404, fileFormat, `Endpoint "${!jsl.isEmpty(requestedEndpoint) ? requestedEndpoint : "/"}" not found - Please read the documentation at ${settings.info.docsURL}#endpoints to see all available endpoints`);
                        }
                    }
                }
                //#SECTION PUT
                else if(req.method === "PUT")
                {
                    //#MARKER Joke submission
                    if(!jsl.isEmpty(parsedURL.pathArray) && parsedURL.pathArray[0] == "submit")
                    {
                        let data = "";
                        let dataGotten = false;
                        req.on("data", chunk => {
                            data += chunk;
                            
                            if(!jsl.isEmpty(data))
                                dataGotten = true;

                            return jokeSubmission(res, data, fileFormat, ip, analyticsObject);
                        });

                        setTimeout(() => {
                            if(!dataGotten)
                            {
                                debug("HTTP", "PUT request timed out");
                                return respondWithError(res, 105, 400, fileFormat, "Request body is empty");
                            }
                        }, 3000);
                    }
                    else
                    {
                        //#MARKER Restart / invalid PUT
                        let data = "";
                        let dataGotten = false;
                        req.on("data", chunk => {
                            data += chunk;

                            if(!jsl.isEmpty(data))
                                dataGotten = true;

                            if(data == process.env.RESTART_TOKEN && parsedURL.pathArray != null && parsedURL.pathArray[0] == "restart")
                            {
                                res.writeHead(200, {"Content-Type": parseURL.getMimeTypeFromFileFormatString(fileFormat)});
                                res.end(convertFileFormat.auto(fileFormat, {
                                    "error": false,
                                    "message": `Restarting ${settings.info.name}`,
                                    "timestamp": new Date().getTime()
                                }));
                                console.log(`\n\n[${logger.getTimestamp(" | ")}]  ${jsl.colors.fg.red}IP ${jsl.colors.fg.yellow}${ip.substr(0, 8)}[...]${jsl.colors.fg.red} sent a restart command\n\n\n${jsl.colors.rst}`);
                                process.exit(2); // if the process is exited with status 2, the package node-wrap will restart the process
                            }
                            else return respondWithErrorPage(req, res, 400, fileFormat, `Request body is invalid or was sent to the wrong endpoint "${parsedURL.pathArray != null ? parsedURL.pathArray[0] : "/"}", please refer to the documentation at ${settings.info.docsURL}#submit-joke to see how to correctly structure a joke submission.`);
                        });

                        setTimeout(() => {
                            if(!dataGotten)
                            {
                                debug("HTTP", "PUT request timed out");
                                return respondWithErrorPage(req, res, 400, fileFormat, "Request body is empty");
                            }
                        }, 3000);
                    }
                }
                //#MARKER Preflight
                //#SECTION HEAD / OPTIONS
                else if(req.method === "HEAD" || req.method === "OPTIONS")
                    serveDocumentation(req, res);
                //#SECTION invalid method
                else
                {
                    res.writeHead(405, {"Content-Type": parseURL.getMimeTypeFromFileFormatString(fileFormat)});
                    res.end(convertFileFormat.auto(fileFormat, {
                        "error": true,
                        "internalError": false,
                        "message": `Wrong method "${req.method}" used. Expected "GET", "OPTIONS" or "HEAD"`,
                        "timestamp": new Date().getTime()
                    }));
                }
            });

            //#MARKER other HTTP stuff
            httpServer.on("error", err => {
                logger("error", `HTTP Server Error: ${err}`, true);
            });

            httpServer.listen(settings.httpServer.port, settings.httpServer.hostname, err => {
                if(!err)
                {
                    rateLimit.init(settings.httpServer.timeFrame, true);
                    debug("HTTP", `${jsl.colors.fg.green}HTTP Server successfully listens on port ${settings.httpServer.port}${jsl.colors.rst}`);
                    return resolve();
                }
                else
                {
                    debug("HTTP", `${jsl.colors.fg.red}HTTP listener init encountered error: ${settings.httpServer.port}${jsl.colors.rst}`);
                    return reject(err);
                }
            });
        };

        fs.readdir(settings.endpoints.dirPath, (err1, files) => {
            jsl.unused(err1);
            files.forEach(file => {
                let fileName = file.split(".");
                fileName.pop();
                fileName = fileName.length > 1 ? fileName.join(".") : fileName[0];

                let endpointFilePath = `${settings.endpoints.dirPath}${file}`;

                if(fs.statSync(endpointFilePath).isFile())
                    endpoints.push({
                        name: fileName,
                        desc: require(`.${endpointFilePath}`).meta.desc, // needs an extra . cause require() is relative to this file, whereas "fs" is relative to the project root
                        absPath: endpointFilePath
                    });
            });

            //#MARKER call HTTP server init
            initHttpServer();
        });
    });
}


//#MARKER error stuff
/**
 * Ends the request with an error. This error gets pulled from the error registry
 * @param {http.ServerResponse} res 
 * @param {Number} errorCode The error code
 * @param {Number} responseCode The HTTP response code to end the request with
 * @param {String} fileFormat The file format to respond with - automatically gets converted to MIME type
 * @param {String} errorMessage Additional error info
 */
const respondWithError = (res, errorCode, responseCode, fileFormat, errorMessage) => {
    try
    {
        let errFromRegistry = require(`.${settings.errors.errorRegistryIncludePath}`)[errorCode.toString()];
        let errObj = {};

        if(fileFormat != "xml")
        {
            errObj = {
                "error": true,
                "internalError": errFromRegistry.errorInternal,
                "code": errorCode,
                "message": errFromRegistry.errorMessage,
                "causedBy": errFromRegistry.causedBy,
                "timestamp": new Date().getTime()
            }
        }
        else if(fileFormat == "xml")
        {
            errObj = {
                "error": true,
                "internalError": errFromRegistry.errorInternal,
                "code": errorCode,
                "message": errFromRegistry.errorMessage,
                "causedBy": {"cause": errFromRegistry.causedBy},
                "timestamp": new Date().getTime()
            }
        }

        if(!jsl.isEmpty(errorMessage))
            errObj.additionalInfo = errorMessage;

        return pipeString(res, convertFileFormat.auto(fileFormat, errObj), parseURL.getMimeTypeFromFileFormatString(fileFormat), responseCode);
    }
    catch(err)
    {
        let errMsg = `Internal error while sending error message.\nOh, the irony...\n\nPlease contact me (${settings.info.author.website}) and provide this additional info:\n${err}`;
        return pipeString(res, errMsg, "text/plain", responseCode);
    }
};

/**
 * Responds with an error page (which one is based on the status code).
 * Defaults to 500
 * @param {http.IncomingMessage} req
 * @param {http.ServerResponse} res 
 * @param {(404|500)} [statusCode=500] HTTP status code - defaults to 500
 * @param {String} fileFormat
 * @param {String} [error] Additional error message that gets added to the "API-Error" response header
 */
const respondWithErrorPage = (req, res, statusCode, fileFormat, error) => {
    jsl.unused([req, fileFormat]);

    statusCode = parseInt(statusCode);

    if(isNaN(statusCode))
    {
        statusCode = 500;
        error += ((!jsl.isEmpty(error) ? " - Ironically, an additional " : "An ") + "error was encountered while sending this error page: \"statusCode is not a number (in: httpServer.respondWithErrorPage)\"");
    }

    if(!jsl.isEmpty(error))
    {
        res.setHeader("Set-Cookie", `errorInfo=${JSON.stringify({"API-Error-Message": error, "API-Error-StatusCode": statusCode})}`);
        res.setHeader("API-Error", error);
    }

    return pipeFile(res, settings.documentation.errorPagePath, "text/html", statusCode);
}

//#MARKER response piping
/**
 * Pipes a string into a HTTP response
 * @param {http.ServerResponse} res The HTTP res object
 * @param {String} text The response body
 * @param {String} mimeType The MIME type to respond with
 * @param {Number} [statusCode=200] The status code to respond with - defaults to 200
 */
const pipeString = (res, text, mimeType, statusCode = 200) => {
    try
    {
        statusCode = parseInt(statusCode);
        if(isNaN(statusCode)) throw new Error("");
    }
    catch(err)
    {
        res.writeHead(500, {"Content-Type": `text/plain; charset=UTF-8`});
        res.end("INTERNAL_ERR:STATUS_CODE_NOT_INT");
        return;
    }

    let s = new Readable();
    s._read = () => {};
    s.push(text);
    s.push(null);

    res.writeHead(statusCode, {
        "Content-Type": `${mimeType}; charset=UTF-8`,
        "Content-Length": text.length
    });

    s.pipe(res);
}

/**
 * Pipes a file into a HTTP response
 * @param {http.ServerResponse} res The HTTP res object
 * @param {String} filePath Path to the file to respond with - relative to the project root directory
 * @param {String} mimeType The MIME type to respond with
 * @param {Number} [statusCode=200] The status code to respond with - defaults to 200
 */
const pipeFile = (res, filePath, mimeType, statusCode = 200) => {
    try
    {
        statusCode = parseInt(statusCode);
        if(isNaN(statusCode))
            throw new Error("err_statuscode_isnan");
    }
    catch(err)
    {
        return respondWithErrorPage(null, res, 500, null, `Encountered internal server error while piping file: wrong type for status code.`);
    }

    if(!fs.existsSync(filePath))
        return respondWithErrorPage(null, res, 404, null, `File at "${filePath}" not found.`);

    try
    {
        res.writeHead(statusCode, {
            "Content-Type": `${mimeType}; charset=UTF-8`,
            "Content-Length": fs.statSync(filePath).size
        });

        let readStream = fs.createReadStream(filePath);
        readStream.pipe(res);
    }
    catch(err)
    {
        logger("fatal", err, true);
    }
}

//#MARKER serve docs
/**
 * Serves the documentation page
 * @param {http.IncomingMessage} req The HTTP req object
 * @param {http.ServerResponse} res The HTTP res object
 */
const serveDocumentation = (req, res) => {
    let resolvedURL = parseURL(req.url);

    if(!lists.isConsoleBlacklisted(resolveIP(req)))
    {
        logRequest("docs", null, {
            ipAddress: resolveIP(req),
            urlParameters: resolvedURL.queryParams,
            urlPath: resolvedURL.pathArray
        });
    }

    let selectedEncoding = getAcceptedEncoding(req);
    let fileExtension = "";


    if(selectedEncoding != null)
        fileExtension = `.${getFileExtensionFromEncoding(selectedEncoding)}`;

    debug("HTTP", `Serving docs with encoding "${selectedEncoding}"`);

    let filePath = `${settings.documentation.compiledPath}documentation.html${fileExtension}`;
    let fallbackPath = `${settings.documentation.compiledPath}documentation.html`;

    fs.exists(filePath, exists => {
        if(exists)
        {
            if(selectedEncoding == null)
                selectedEncoding = "identity"; // identity = no encoding (see https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Encoding)
            
            res.setHeader("Content-Encoding", selectedEncoding);

            return pipeFile(res, filePath, "text/html", 200);
        }
        else
            return pipeFile(res, fallbackPath, "text/html", 200);
    }); 
}

//#MARKER util
/**
 * Returns the name of the client's accepted encoding with the highest priority
 * @param {http.IncomingMessage} req The HTTP req object
 * @returns {null|"gzip"|"deflate"|"brotli"} Returns null if no encodings are supported, else returns the encoding name
 */
const getAcceptedEncoding = req => {
    let selectedEncoding = null;

    let encodingPriority = [];

    settings.httpServer.encodings.brotli  && encodingPriority.push("br");
    settings.httpServer.encodings.gzip    && encodingPriority.push("gzip");
    settings.httpServer.encodings.deflate && encodingPriority.push("deflate");

    encodingPriority = encodingPriority.reverse();

    let acceptedEncodings = [];
    if(req.headers["accept-encoding"])
        acceptedEncodings = req.headers["accept-encoding"].split(/\s*[,]\s*/gm);
    acceptedEncodings = acceptedEncodings.reverse();

    encodingPriority.forEach(encPrio => {
        if(acceptedEncodings.includes(encPrio))
            selectedEncoding = encPrio;
    });

    return selectedEncoding;
}

/**
 * Returns the file extension for the provided encoding (without dot prefix)
 * @param {null|"gzip"|"deflate"|"br"} encoding
 * @returns {String}
 */
const getFileExtensionFromEncoding = encoding => {
    switch(encoding)
    {
        case "gzip":
            return "gz";
        case "deflate":
            return "zz";
        case "br":
            return "br";
        default:
            return "";
    }
}

module.exports = { init, respondWithError, respondWithErrorPage, pipeString, pipeFile, serveDocumentation, getAcceptedEncoding, getFileExtensionFromEncoding };