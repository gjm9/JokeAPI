"use strict";

var settings = {
    baseURL: "<!--%#INSERT:DOCSURL#%-->",
    jokeEndpoint: "joke",
    anyCategoryName: "Any",
    defaultFormat: "json"
};

if(settings.baseURL.endsWith("/"))
{
    settings.baseURL = settings.baseURL.substr(0, (settings.baseURL.length - 1));
}

var qstr = null;
var tryItOk = false;
var tryItURL = "";
var dIHTML = `
<h2>To provide this service to you, JokeAPI needs to collect some anonymous data.</h2>

<br>

<a href="<!--%#INSERT:PRIVACYPOLICYURL#%-->" target="_blank">View the privacy policy by clicking here.</a>

<br><br><br>

<b>This is a list of everything JokeAPI stores temporarily (this data will be deleted after about a month):</b><br>
<ul>
    <li>A hash of your IP address, your request headers, the request method and the request date and time (this will be kept inside a secure log file so I can debug JokeAPI and help you solve any issues you might have)</li>
</ul>

<br><br>

<b>This is a list of everything JokeAPI stores indefinitely:</b><br>
<ul>
    <li>A hash of your IP address <u>if it gets added to the <i>blacklist</i>.</u> This happens if you have shown malicious behavior or have exceeded the rate limiting for too long / often</li>
    <li>A hash of your IP address <u>if it gets added to a <i>whitelist</i>.</u> This only happens if you contacted me to get more requests per minute or are partnered with me and have been informed that this is happening</li>
    <li>A hash of your IP address <u>if it gets added to a <i>console blacklist</i>.</u> This (if at all) also only happens if you are partnered with me</li>
    <li>The requested URL, consisting of the URL path, the URL parameters and the URL anchor</li>
    <li>The payload of joke submissions (using PUT requests on the submission endpoint)</li>
</ul>

<br><br>

<b>Terminology:</b><br>
&nbsp;&nbsp;&nbsp;&nbsp;Hash:<br>
&nbsp;&nbsp;&nbsp;&nbsp;A hash uses an algorithm to encode the input to something that cannot be reconstructed to the initial input again.<br>
&nbsp;&nbsp;&nbsp;&nbsp;In the case of JokeAPI, your IP address gets hashed and stored to a database. In this hashed state, your original IP address can not be reconstructed and you will stay completely anonymous.

<br><br><br>

Please note that the collection of the above listed data is necessary to provide you this service.<br>
Without it, rate limiting wouldn't be possible. This would lead to the API and all of my other services being taken down by DoS-attacks.<br>
This has already happened before and it has impacted all of my services to the point of them being completely unresponsive.<br><br>
You can request to get your collected data deleted or to view the data about you that JokeAPI collected (according to <a href="https://www.privacy-regulation.eu/en/article-12-transparent-information-communication-and-modalities-for-the-exercise-of-the-rights-of-the-data-subject-GDPR.htm">article 12 GDPR</a>) by sending me an e-mail: <a href="mailto:sven.fehler@web.de">sven.fehler@web.de</a>
<br><br><br>
`;

var cIHTML = `
<iframe src="<!--%#INSERT:DOCSURL#%-->/static/changelog" style="width: 100%; height: 80%; font-family: 'Roboto', 'Segoe UI', 'Arial', sans-serif; color: black !important; background-color: white !important;"></iframe><br>
<br>
(Current Version is [<!--%#INSERT:VERSION#%-->])
`;

var rsIHTML = `
<form onsubmit="submitRestartForm()">
<input type="password" id="restartFormToken" placeholder="Restart Token" style="width:30vw"> <button type="submit">Send &gt;</button>
</form>
`;

var sMenu=new function(){this.new=function(id,title,innerhtml,width,height,border_rounded,closable_ESC,closable_btn,on_close,close_img_src){if(typeof id=="string"&&typeof title=="string"&&typeof innerhtml=="string"&&typeof width=="number"&&typeof height=="number"){if(gebid("jsg_menu_"+id)!=null){console.error("a menu with the ID "+id+" already exists - not creating a new one");return}
/* eslint-disable-next-line */
if(!border_rounded)border_rounded=!0;if(typeof closable_ESC!="boolean")closable_ESC=!0;if(typeof closable_btn!="boolean")closable_btn=!0;if(!on_close)on_close=function(){};if(!close_img_src)close_img_src="https://sv443.net/resources/images/jsg_menu_close.png";var menuelem=document.createElement("div");menuelem.style.display="none";menuelem.style.opacity="0";menuelem.style.transition="opacity 0.3s ease-in";menuelem.style.overflow="auto";menuelem.className="jsg_menu";menuelem.id="jsg_menu_"+id;menuelem.style.position="fixed";menuelem.style.top=((100-height)/2)+"vh";menuelem.style.left=((100-width)/2)+"vw";menuelem.style.width=width+"vw";menuelem.style.height=height+"vh";menuelem.style.padding="10px";menuelem.style.border="2px solid #454545";if(border_rounded)menuelem.style.borderRadius="1.2em";else menuelem.style.borderRadius="0";if(closable_btn)var closebtnih='<img onclick="sMenu.close(\''+id+'\')" class="jsg_menuclosebtn" title="Close" src="https://sv443.net/cdn/jsl/closebtn.png" style="cursor:pointer;position:absolute;top:0;right:0;width:1.5em;height:1.5em;">';else closebtnih="";menuelem.style.backgroundColor="#ddd";menuelem.innerHTML="<div class='jsg_menutitle' style='font-size:1.5em;text-align:center;'>"+title+"</div>"+closebtnih+"<br>"+innerhtml;document.body.appendChild(menuelem);if(closable_ESC)document.addEventListener("keydown",function(e){if(e.keyCode==27)sMenu.close(id)})}
else{console.error("the arguments for Menu.new() are wrong");return!1}}
this.close=function(id){try{setTimeout(function(){gebid("jsg_menu_"+id).style.display="none"},500);gebid("jsg_menu_"+id).style.opacity="0";gebid("jsg_menu_"+id).style.transition="opacity 0.3s ease-in"}
catch(err){console.error("couldn't find menu with id "+id+". Is the ID correct and was the menu created correctly?");return!1}}
this.open=function(id){try{gebid("jsg_menu_"+id).style.display="block";setTimeout(function(){gebid("jsg_menu_"+id).style.opacity="1";gebid("jsg_menu_"+id).style.transition="opacity 0.3s ease-out"},20)}
catch(err){console.error("couldn't find menu with id "+id+". Is the ID correct and was the menu created correctly?");return!1}}
this.theme=function(id,theme){try{if(theme=="dark"){gebid("jsg_menu_"+id).style.backgroundColor="#454545";gebid("jsg_menu_"+id).style.color="white";gebid("jsg_menu_"+id).style.borderColor="#ddd";gebid("jsg_menu_"+id).style.transition="background-color 0.4s ease-out, color 0.4s ease-out, border-color 0.4s ease-out"}
else{gebid("jsg_menu_"+id).style.backgroundColor="#ddd";gebid("jsg_menu_"+id).style.color="black";gebid("jsg_menu_"+id).style.borderColor="#454545";gebid("jsg_menu_"+id).style.transition="background-color 0.4s ease-out, color 0.4s ease-out, border-color 0.4s ease-out"}}
catch(err){console.error("couldn't find menu with id "+id+". Is the ID correct and was the menu created correctly?");return!1}}
this.setInnerHTML=function(id,inner_html){try{gebid("jsg_menu_"+id).innerHTML=inner_html}
catch(err){console.error("couldn't find menu or inner_html is not valid");return!1}}
this.setOuterHTML=function(id,outer_html){try{gebid("jsg_menu_"+id).outerHTML=outer_html}
catch(err){console.error("couldn't find menu or outer_html is not valid");return!1}}}
function gebid(id){return document.getElementById(id);}

//#MARKER onload
function onLoad()
{
    console.log("%cJokeAPI%cDocumentation (v<!--%#INSERT:VERSION#%-->)", "color: #b05ffc; background-color: black; padding: 5px; padding-right: 0;", "color: white; background-color: black; padding: 5px;");

    window.jokeapi = {};

    gebid("content").onclick = closeNav;
    document.getElementsByTagName("header")[0].onclick = closeNav;
    gebid("docTitle").onclick = function() {window.location.reload()};

    addCodeTabs();

    sMenu.new("privacyPolicy", "What data does JokeAPI collect?", dIHTML, 85, 85, true, true, true);
    sMenu.theme("privacyPolicy", "dark");

    sMenu.new("restartPrompt", "Restart <!--%#INSERT:NAME#%-->", rsIHTML, 40, 30, true, true, true);
    sMenu.theme("restartPrompt", "dark");


    // eslint-disable-next-line no-undef
    if(Cookies.get("hideUsageTerms") == "true")
    {
        gebid("usageTerms").style.display = "none";
    }
    else
    {
        gebid("usageTerms").style.display = "inline-block";
    }

    try
    {
        // put ES6+ code here
        qstr = getQueryStringObject();

        if(qstr != null && qstr["devFeatures"] == "true")
            gebid("devStuff").style.display = "inline-block";
    }
    catch(err) {unused();}

    document.addEventListener("keydown", function(e) {
        if(e.key == "Escape" && window.jokeapi.sidenavOpened)
            closeNav();
        else if(e.key == "R" && e.altKey && e.shiftKey)
        {
            openRestartForm();
        }
    });

    resetTryItForm();

    setTimeout(function() {
        gebid("usageTerms").dataset.animateBorder = "true";
    }, 800);

    buildURL();

    document.getElementById("content").addEventListener("click", function(e) {
        if(document.body.dataset["sidenav"] == "opened")
        {
            e.preventDefault();
            closeNav();
        }
    });

    var fileFormats = JSON.parse('<!--%#INSERT:FILEFORMATARRAY#%-->');
    if(fileFormats.includes("JSON"))
    {
        fileFormats.splice(fileFormats.indexOf("JSON"), 1);
    }
    Array.from(document.getElementsByClassName("insFormatsS")).forEach(function(el) {
        el.innerHTML = fileFormats.join(" and ");
    });

    var flags = JSON.parse('<!--%#INSERT:FLAGSARRAY#%-->');
    Array.from(document.getElementsByClassName("insFlags")).forEach(function(el) {
        el.innerHTML = flags.join(", ");
    });

    var formats = JSON.parse('<!--%#INSERT:FILEFORMATARRAY#%-->');
    Array.from(document.getElementsByClassName("insFormats")).forEach(function(el) {
        el.innerHTML = formats.join(", ").toLowerCase();
    });

    var categories = JSON.parse('<!--%#INSERT:CATEGORYARRAY#%-->');
    Array.from(document.getElementsByClassName("insCategories")).forEach(function(el) {
        el.innerHTML = categories.join(", ");
    });
}

function addCodeTabs()
{
    var codeElements = document.getElementsByTagName("code");

    for(var i = 0; i < codeElements; i++)
    {
        if(codeElements[i].classList.contains("prettyprint"))
            codeElements[i].innerHTML = codeElements[i].innerHTML.replace(/&tab;/gm, "&nbsp;&nbsp;&nbsp;&nbsp;");
    }
}

//#MARKER SideNav
function openNav()
{
    setTimeout(function() {
        document.body.dataset["sidenav"] = "opened";
    }, 50);

    window.jokeapi.sidenavOpened = true;

    gebid("sidenav").style.width = "280px";
    gebid("content").style.marginLeft= "280px";
    document.getElementsByTagName("header")[0].dataset["grayscaled"] = "true";
    gebid("sideNavOpen").style.visibility = "hidden";
}
  
function closeNav()
{
    if(document.body.dataset["sidenav"] != "opened")
        return;

    window.jokeapi.sidenavOpened = false;

    document.body.dataset["sidenav"] = "closed";

    gebid("sidenav").style.width = "0";
    gebid("content").style.marginLeft= "10px";
    document.getElementsByTagName("header")[0].dataset["grayscaled"] = "false";
    gebid("sideNavOpen").style.visibility = "visible";
}

function getQueryStringObject()
{
    var qstrObj = {};

    if(!window.location.href.includes("?"))
        return null;

    var rawQstr = window.location.href.split("?")[1];
    var qstrArr = [];

    if(rawQstr.includes("#"))
        rawQstr = rawQstr.split("#")[0];

    if(rawQstr != null && rawQstr.includes("&"))
        qstrArr = rawQstr.split("&");
    else if(rawQstr != null)
        qstrArr = [rawQstr];
    else return null;


    if(qstrArr.length > 0)
        qstrArr.forEach(function(qstrEntry) {
            if(qstrEntry.includes("="))
                qstrObj[qstrEntry.split("=")[0]] = qstrEntry.split("=")[1];
        });
    else return null;

    return qstrObj;
}

function openChangelog()
{
    if(!document.getElementById("jsg_menu_changelog"))
    {
        sMenu.new("changelog", "JokeAPI Changelog:", cIHTML, 85, 85, true, true, true);
        sMenu.theme("changelog", "dark");
    }
    sMenu.open("changelog");
}

function reRender()
{
    var allOk = true;

    //#SECTION category
    var isValid = false;
    document.getElementsByName("catSelect").forEach(function(el) {
        if(!el.checked)
            return;

        if(el.value == "any")
        {
            isValid = true;
            ["cat-cb1", "cat-cb2", "cat-cb3"].forEach(function(cat) {
                gebid(cat).disabled = true;
            });
        }
        else
        {
            var isChecked = false;
            ["cat-cb1", "cat-cb2", "cat-cb3"].forEach(function(cat) {
                var cel = gebid(cat);
                cel.disabled = false;

                if(cel.checked)
                    isChecked = true;
            });

            if(isChecked)
                isValid = true;
        }
    });

    if(!isValid)
    {
        allOk = false;
        gebid("categoryWrapper").style.borderColor = "red";
    }
    else
    {
        gebid("categoryWrapper").style.borderColor = "initial";
    }


    //#SECTION format
    if(!gebid("typ-cb1").checked && !gebid("typ-cb2").checked)
    {
        allOk = false;
        gebid("typeSelectWrapper").style.borderColor = "red";
    }  
    else
    {
        gebid("typeSelectWrapper").style.borderColor = "initial";
    }


    //#SECTION id range
    var numRegex = /^[0-9]+$/gm;
    var fromVal = gebid("idRangeInputFrom").value;
    var toVal = gebid("idRangeInputTo").value;
    var fromValInt = parseInt(fromVal);
    var toValInt = parseInt(toVal);
    var outOfRange = fromValInt < 0 || toValInt > parseInt("<!--%#INSERT:TOTALJOKESZEROINDEXED#%-->");
    var notNumber = ((fromVal.match(numRegex) == null) || (toVal.match(numRegex) == null));

    if(outOfRange || notNumber || fromValInt > toValInt)
    {
        allOk = false;
        gebid("idRangeWrapper").style.borderColor = "red";
    }
    else
    {
        gebid("idRangeWrapper").style.borderColor = "initial";
    }

    if(allOk)
    {
        tryItOk = true;
    }
    else
    {
        tryItOk = false;
    }

    buildURL();
}

//#MARKER build URL
function buildURL()
{
    var queryParams = [];

    //#SECTION categories
    var selectedCategories = [settings.anyCategoryName];
    if(gebid("cat-radio2").checked)
    {
        selectedCategories = [];
        if(gebid("cat-cb1").checked)
        {
            selectedCategories.push("Programming");
        }
        if(gebid("cat-cb2").checked)
        {
            selectedCategories.push("Miscellaneous");
        }
        if(gebid("cat-cb3").checked)
        {
            selectedCategories.push("Dark");
        }

        if(selectedCategories.length == 0)
        {
            selectedCategories.push(settings.anyCategoryName);
        }
    }


    //#SECTION flags
    var flagElems = [gebid("blf-cb1"), gebid("blf-cb2"), gebid("blf-cb3"), gebid("blf-cb4"), gebid("blf-cb5")];
    var flagNames = ["nsfw", "religious", "political", "racist", "sexist"];
    var selectedFlags = [];
    flagElems.forEach(function(el, i) {
        if(el.checked)
        {
            selectedFlags.push(flagNames[i]);
        }
    });

    if(selectedFlags.length > 0)
    {
        queryParams.push("blacklistFlags=" + selectedFlags.join(","));
    }


    //#SECTION format
    var formatElems = [gebid("fmt-cb1"), gebid("fmt-cb2"), gebid("fmt-cb3")];
    formatElems.forEach(function(el) {
        if(el.checked && el.value != settings.defaultFormat)
        {
            queryParams.push("format=" + el.value);
        }
    });


    //#SECTION type
    var singleJoke = gebid("typ-cb1").checked;
    var twopartJoke = gebid("typ-cb2").checked;
    if(singleJoke ^ twopartJoke == 1)
    {
        if(singleJoke)
        {
            queryParams.push("type=single");
        }
        else if(twopartJoke)
        {
            queryParams.push("type=twopart");
        }
    }


    //#SECTION search string
    var sstr = gebid("searchStringInput").value;
    if(sstr)
    {
        queryParams.push("contains=" + encodeURIComponent(sstr));
    }


    //#SECTION id range
    var range = [parseInt(gebid("idRangeInputFrom").value), parseInt(gebid("idRangeInputTo").value)];
    if(!isNaN(range[0]) && !isNaN(range[1]) && range[0] >= 0 && range[1] <= parseInt("<!--%#INSERT:TOTALJOKESZEROINDEXED#%-->") && range[1] >= range[0])
    {
        if(range[0] == range[1] && range[0] > 0 && range[0] <= parseInt("<!--%#INSERT:TOTALJOKESZEROINDEXED#%-->"))
        {
            // Use "x" format
            queryParams.push("idRange=" + range[0]);
        }
        else if(range[0] != 0 || range[1] != parseInt("<!--%#INSERT:TOTALJOKESZEROINDEXED#%-->"))
        {
            // Use "x-y" format
            queryParams.push("idRange=" + range[0] + "-" + range[1]);
        }
    }


    tryItURL = settings.baseURL + "/" + settings.jokeEndpoint + "/" + selectedCategories.join(",");

    if(queryParams.length > 0)
    {
        tryItURL += "?" + queryParams.join("&");
    }

    gebid("urlBuilderUrl").innerHTML = tryItURL;
}

//#MARKER send request
function sendTryItRequest()
{
    var prpr = gebid("urlBuilderPrettyprint");
    var tryItRequestError = function(err) {
        if(!prpr.classList.contains("prettyprint"))
        {
            prpr.classList.remove("prettyprint");
        }

        if(prpr.classList.contains("prettyprinted"))
        {
            prpr.classList.remove("prettyprinted");
        }

        gebid("tryItResult").innerHTML = "Error:<br><br>" + err;
    }

    if(!tryItOk)
    {
        return tryItRequestError("One or more of the parameters you specified are invalid.\nThey are outlined with a red border.\n\nPlease correct the parameters and try again.");
    }

    if(!prpr.classList.contains("prettyprint"))
    {
        prpr.classList.add("prettyprint");
    }

    if(prpr.classList.contains("prettyprinted"))
    {
        prpr.classList.remove("prettyprinted");
    }

    if(prpr.classList.contains("lang-json"))
    {
        prpr.classList.remove("lang-json");
    }

    if(prpr.classList.contains("lang-yaml"))
    {
        prpr.classList.remove("lang-yaml");
    }

    if(prpr.classList.contains("lang-xml"))
    {
        prpr.classList.remove("lang-xml");
    }

    prpr.classList.add("lang-json");

    try
    {
        var xhr = new XMLHttpRequest();
        xhr.open("GET", tryItURL);
        xhr.onreadystatechange = function() {
            if(xhr.readyState == 4 && (xhr.status < 300 || xhr.status == 429))
            {
                var result = "";
                if(xhr.getResponseHeader("content-type").includes("json"))
                {
                    result = JSON.stringify(JSON.parse(xhr.responseText.toString()), null, 4);
                }
                else
                {
                    if(xhr.getResponseHeader("content-type").includes("xml"))
                    {
                        gebid("urlBuilderPrettyprint").classList.remove("lang-json");
                        gebid("urlBuilderPrettyprint").classList.add("lang-xml");
                    }
                    else
                    {
                        gebid("urlBuilderPrettyprint").classList.remove("lang-json");
                        gebid("urlBuilderPrettyprint").classList.add("lang-yaml");
                    }

                    result = xhr.responseText.toString();
                    result = result.replace(/[<]/gm, "&lt;");
                    result = result.replace(/[>]/gm, "&gt;");
                }

                gebid("tryItResult").innerHTML = result;

                PR.prettyPrint(); // eslint-disable-line no-undef
            }
            else
            {
                tryItRequestError(xhr.responseText);
            }
        }
        xhr.send();
    }
    catch(err)
    {
        tryItRequestError(err);
    }
}

//#MARKER interactive elements
function resetTryItForm()
{
    ["cat-cb1", "cat-cb2", "cat-cb3"].forEach(function(cat) {
        gebid(cat).checked = false;
    });

    gebid("cat-radio1").checked = true;

    ["blf-cb1", "blf-cb2", "blf-cb3", "blf-cb4", "blf-cb5"].forEach(function(flg) {
        gebid(flg).checked = false;
    });

    gebid("fmt-cb1").checked = true;

    ["typ-cb1", "typ-cb2"].forEach(function(type) {
        gebid(type).checked = true;
    });

    gebid("searchStringInput").value = "";

    gebid("idRangeInputFrom").value = 0;
    gebid("idRangeInputTo").value = parseInt("<!--%#INSERT:TOTALJOKESZEROINDEXED#%-->");

    reRender();
}

//#MARKER privacy policy
function privPolMoreInfo()
{
    sMenu.open("privacyPolicy");
}

function hideUsageTerms()
{
    gebid("usageTerms").style.display = "none";
    Cookies.set("hideUsageTerms", "true", {"expires": 365}); // eslint-disable-line no-undef
}


//#MARKER misc
function openRestartForm()
{
    sMenu.open("restartPrompt");
}

function submitRestartForm()
{
    restart(document.getElementById("restartFormToken").value || null);
    sMenu.close("restartPrompt");
}

function restart(token)
{
    if(!token)
    {
        token = prompt("Enter restart token:");
    }

    if(!token)
    {
        return;
    }

    var restartXhr = new XMLHttpRequest();
    restartXhr.open("PUT", settings.baseURL + "/restart");
    restartXhr.onreadystatechange = function() {
        if(restartXhr.readyState == 4)
        {
            if(restartXhr.status == 400)
            {
                console.warn("Error 400 - The entered token is invalid");
                alert("Error 400 - The entered token is invalid");
            }
            else if(restartXhr.status >= 300)
            {
                console.warn("Error " + restartXhr.status + " - " + restartXhr.responseText);
                alert("Error " + restartXhr.status + " - " + restartXhr.responseText);
            }
            else if(restartXhr.status < 300)
            {
                var xhrData = JSON.parse(restartXhr.responseText);
                console.info(xhrData.message + "\nInternal Time of Restart: " + toFormattedDate(xhrData.timestamp));
                alert(xhrData.message + "\nInternal Time of Restart: " + toFormattedDate(xhrData.timestamp));
            }
        }
    };
    restartXhr.send(token.toString());
}

function toFormattedDate(unixTimestamp)
{
    var d = new Date(unixTimestamp);
    return d.toLocaleString("de-DE");
}



//#MARKER cleanup
function unused(...args)
{
    args.forEach(function(arg) {
        try{arg.toString();}
        catch(err) {return;}
        return;
    });
}

unused(openNav, closeNav, onLoad, openChangelog, reRender, privPolMoreInfo, hideUsageTerms, sendTryItRequest, submitRestartForm);