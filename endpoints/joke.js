const http = require("http");
const convertFileFormat = require("../src/fileFormatConverter");
const httpServer = require("../src/httpServer");
const parseURL = require("../src/parseURL");
const parseJokes = require("../src/parseJokes");
const FilteredJoke = require("../src/classes/FilteredJoke");
const jsl = require("svjsl");
const settings = require("../settings");

jsl.unused(http);


const meta = {
    "name": "Joke",
    "desc": "Returns a joke from the specified category / categories that is also matching the provided (optional) filters",
    "usage": {
        "method": "GET",
        "url": `${settings.info.docsURL}/joke/{CATEGORY}`,
        "supportedParams": [
            "format",
            "blacklistFlags",
            "type",
            "contains",
            "idRange"
        ]
    }
};

/**
 * Calls this endpoint
 * @param {http.IncomingMessage} req The HTTP server request
 * @param {http.ServerResponse} res The HTTP server response
 * @param {Array<String>} url URL path array gotten from the URL parser module
 * @param {Object} params URL query params gotten from the URL parser module
 * @param {String} format The file format to respond with
 */
const call = (req, res, url, params, format) => {
    jsl.unused([req, url]);

    let filterJoke = new FilteredJoke(parseJokes.allJokes);

    //#SECTION category validation
    let category = (url[settings.httpServer.urlPathOffset + 1]|| "(empty)").toLowerCase() || "";

    let includesSplitChar = false;
    settings.jokes.splitChars.forEach(splC => {
        if(!jsl.isEmpty(category) && category.includes(splC))
            includesSplitChar = true;
    });

    if(includesSplitChar)
        category = category.split(settings.jokes.splitCharRegex);
    
    let categoryValid = false;
    [settings.jokes.possible.anyCategoryName, ...settings.jokes.possible.categories].forEach(cat => {
        if(typeof category == "string")
        {
            if(category.toLowerCase() == cat.toLowerCase())
                categoryValid = true;
        }
        else if(typeof category == "object")
        {
            if(category.map(c => c.toLowerCase()).includes(cat.toLowerCase()))
                categoryValid = true;
        }
    });

    let fCat = false;
    if(!Array.isArray(category))
        fCat = filterJoke.setAllowedCategories([category]);
    else fCat = filterJoke.setAllowedCategories(category);

    if(!fCat || !categoryValid)
        return isErrored(res, format, `The specified categor${category.length == undefined || typeof category != "object" || category.length == 1 ? "y is" : "ies are"} invalid - Got: "${category.length == undefined || typeof category != "object" ? category : category.join(", ")}" - Possible categories are: "${[settings.jokes.possible.anyCategoryName, ...settings.jokes.possible.categories].join(", ")}" (case insensitive)`);
    
    if(!jsl.isEmpty(params))
    {
        //#SECTION type
        if(!jsl.isEmpty(params["type"]) && settings.jokes.possible.types.map(t => t.toLowerCase()).includes(params["type"].toLowerCase()))
        {
            if(!filterJoke.setAllowedType(params["type"].toLowerCase()))
                return isErrored(res, format, `The specified type is invalid - Got: "${params["type"]}" - Possible types are: "${settings.jokes.possible.types}"`);
        }
        
        //#SECTION contains
        if(!jsl.isEmpty(params["contains"]))
        {
            if(!filterJoke.setSearchString(params["contains"].toLowerCase()))
                return isErrored(res, format, `The specified type is invalid - Got: "${params["type"]}" - Possible types are: "${settings.jokes.possible.types.join(", ")}"`);
        }

        //#SECTION idRange
        if(!jsl.isEmpty(params["idRange"]))
        {
            try
            {
                if(params["idRange"].match(settings.jokes.splitCharRegex))
                {
                    let splitParams = params["idRange"].split(settings.jokes.splitCharRegex);

                    if(!filterJoke.setIdRange(parseInt(splitParams[0]), parseInt(splitParams[1])))
                        return isErrored(res, format, `The specified ID range is invalid - Got: "${splitParams[0]} to ${splitParams[1]}" - ID range is: "0-${(parseJokes.jokeCount - 1)}"`);
                }
                else
                {
                    let id = parseInt(params["idRange"]);
                    if(!filterJoke.setIdRange(id, id))
                        return isErrored(res, format, `The specified ID range is invalid - Got: "${params["idRange"]}" - ID range is: "0-${(parseJokes.jokeCount - 1)}"`);
                }
            }
            catch(err)
            {
                return isErrored(res, format, `The values in the "idRange" parameter are invalid or are not numbers - ${err}`);
            }
        }

        //#SECTION blacklistFlags
        if(!jsl.isEmpty(params["blacklistFlags"]))
        {
            let flags = params["blacklistFlags"].split(settings.jokes.splitCharRegex) || [];
            let erroredFlags = [];
            flags.forEach(fl => {
                if(!settings.jokes.possible.flags.includes(fl))
                    erroredFlags.push(fl);
            });

            if(erroredFlags.length > 0)
                return isErrored(res, format, `The specified flags are invalid - Got: "${flags.join(", ")}" - Possible flags are: "${settings.jokes.possible.flags.join(", ")}"`);
            
            let fFlg = filterJoke.setBlacklistFlags(flags);
            if(!fFlg)
                return isErrored(res, format, `The specified flags are invalid - Got: "${flags.join(", ")}" - Possible flags are: "${settings.jokes.possible.flags.join(", ")}"`);
        }
    }
    

    filterJoke.getJoke().then(joke => {
        if(!joke["error"])
            joke["error"] = false;
        let responseText = convertFileFormat.auto(format, joke);
        httpServer.pipeString(res, responseText, parseURL.getMimeTypeFromFileFormatString(format));
    }).catch(err => {
        return isErrored(res, format, `Error while finalizing joke filtering: ${err}`);
    });
};

/**
 * Responds with a preformatted error message
 * @param {http.ServerResponse} res 
 * @param {String} format 
 * @param {String} msg 
 */
const isErrored = (res, format, msg) => {
    let errFromRegistry = require("." + settings.errors.errorRegistryIncludePath)["106"];
    let errorObj = {}
    if(format != "xml")
    {
        errorObj = {
            error: true,
            internalError: false,
            code: 106,
            message: errFromRegistry.errorMessage,
            causedBy: errFromRegistry.causedBy,
            additionalInfo: msg,
            timestamp: new Date().getTime()
        };
    }
    else if(format == "xml")
    {
        errorObj = {
            error: true,
            internalError: false,
            code: 106,
            message: errFromRegistry.errorMessage,
            causedBy: {"cause": errFromRegistry.causedBy},
            additionalInfo: msg,
            timestamp: new Date().getTime()
        };
    }

    let responseText = convertFileFormat.auto(format, errorObj);
    httpServer.pipeString(res, responseText, parseURL.getMimeTypeFromFileFormatString(format));
};

module.exports = { meta, call };