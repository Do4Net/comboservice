var fs          =   require('fs');
var path        =   require('path');
var http        =   require('http');
var url         =   require("url");
var zlib        =   require("zlib");
var mime        =   require("mime");
var serverConfig=   require("./config/server.json");

function getMime( pathinfo ){

    return mime.lookup( path.extname( pathinfo ).replace(/^\./, "")) ||  "text/plain"; 
}

http.createServer(function ( request, response ) { 

    var urlInfo = parseURL( serverConfig.Root, request.url );  
    validateFiles( urlInfo.pathnames, function (err, pathnames,modifiedTime) {
        if (err) {

            response.writeHead(404);
            response.end(err.message);
        } else { 

            handlerModifyRequest(response,request,urlInfo,modifiedTime,outputFiles)
        }  
    })
     
}).listen(serverConfig.Port);

function handlerModifyRequest( response,request,urlInfo,modifiedTime,callback ){

    var pathnames=urlInfo.pathnames;
    var expires = new Date();
    expires.setTime( expires.getTime() + serverConfig.ExpressMaxAge * 1000 );
    response.setHeader("Expires", expires.toUTCString());
    response.setHeader("Cache-Control", "max-age=" + serverConfig.ExpressMaxAge);
     
    var lastModified = findLastModifyTime( modifiedTime );
    if (request.headers["if-modified-since"] && lastModified == request.headers["if-modified-since"]) {

        response.writeHead(304, "Not Modified");
        response.end();
    }else{

        response.setHeader("Last-Modified", lastModified);
        response.writeHead(200, {
            'Content-Type': urlInfo.mime
        }); 
        callback(pathnames, response,modifiedTime);
    } 

}

function findLastModifyTime(modifiedTime){

     var lastModifiedTime=0;
     Object.keys(modifiedTime).forEach(function(item){
        if(lastModifiedTime<=(+modifiedTime[item])){
            lastModifiedTime=(+modifiedTime[item]);
        }
     })

    return new Date(lastModifiedTime).toUTCString(); 
}

Date.prototype.format = function(fmt)   
{ 
  var o = {   
    "M+" : this.getMonth()+1,                 //月份   
    "d+" : this.getDate(),                    //日   
    "h+" : this.getHours(),                   //小时   
    "m+" : this.getMinutes(),                 //分   
    "s+" : this.getSeconds(),                 //秒   
    "q+" : Math.floor((this.getMonth()+3)/3), //季度   
    "S"  : this.getMilliseconds()             //毫秒   
  };   
  if(/(y+)/.test(fmt))   
    fmt=fmt.replace(RegExp.$1, (this.getFullYear()+"").substr(4 - RegExp.$1.length));   
  for(var k in o)   
    if(new RegExp("("+ k +")").test(fmt))   
  fmt = fmt.replace(RegExp.$1, (RegExp.$1.length==1) ? (o[k]) : (("00"+ o[k]).substr((""+ o[k]).length)));   
  return fmt;   
}  
 
function outputFiles(pathnames, response,modifiedTime) {
    (function next(i, len) {
        if (i < len) { 
            var reader = fs.createReadStream(pathnames[i]); 
            reader.pipe(response, { end: false });
            reader.on('end', function() {
                response.write(`\r\n\/\/--------- Read Static File Name: ${pathnames[i]} End ---ModifiedTime: ${modifiedTime[pathnames[i]].format("yyyy-MM-dd hh:mm:ss")}---------\r\n`);
                next(i + 1, len);
            });
        } else {
            response.end();
        }
    }(0, pathnames.length));
}

function validateFiles( pathnames, callback ) {

    var modifiedTime={};
    (function next( i, len ) {

        if (i < len) {

            fs.stat( pathnames[i], function (err, stats) {
                if (err) {

                    callback(err);
                } else if (!stats.isFile()) {

                    callback(new Error());
                } else { 

                    modifiedTime[pathnames[i]]=stats.mtime;
                    next(i + 1, len);
                }
            } );
        } else { 

            callback(null, pathnames,modifiedTime);
        }
    }(0, pathnames.length));
}

function parseURL( root, url ) {

    var base, pathnames, parts; 
    if (url.indexOf('??') === -1) {

        url = url.replace('/', '/??');
    }

    parts = url.split('??');
    base = parts[0];
    pathnames = parts[1].split(',').map(function ( value ) {

        return path.join( root, base, value );
    });

    return {
        mime:getMime( pathnames[0] ),
        pathnames: pathnames
    };
}