const express = require('express');
const { URL } = require('url');

const http = require('http');
const https = require('https');
const followRedirects = require('follow-redirects');

const app = express();

function getURL(str) {
  try {
    return new URL(decodeURIComponent(str));
  }
  catch {
    return null;
  }
}

// Add CORS headers and handle preflight
app.use((req, res, next) => {
  if (req.headers['access-control-request-method']) {
		res.set('Access-Control-Allow-Methods', req.headers['access-control-request-method']);
	}
	if (req.headers['access-control-request-headers']) {
		res.set('Access-Control-Allow-Headers', req.headers['access-control-request-headers']);
	}
	res.set('Access-Control-Allow-Origin', req.headers.origin || '*');
	
  if (req.method === 'OPTIONS') {
    return res.status(200).send();
  }
  
  next();
});

function checkUrl(req, res, next) {
  const location = getURL(req.params.url);
  if (!location) {
    return res.status(400)
      .send('No url specified');
  }
  if (location.port > 65535) {
    return res.status(400)
      .send('Invalid port');
  }
  req.options = {
    location
  };
  
  next();
}

function proxyRequest(location, req, res, agent, pipe = false) {
  const proxyReq = (location.protocol === 'https:' ? agent.https : agent.http)
    .get(location, (proxyRes) => {      
      if (!res.headersSent) {
        if (proxyRes.statusMessage) {
          res.statusCode = proxyRes.statusCode;
          res.statusMessage = proxyRes.statusMessage;
        } else {
          res.statusCode = proxyRes.statusCode;
        }
        
        if (proxyRes.headers['content-type']) {
          res.set('Content-Type', proxyRes.headers['content-type']);
        }
      }
      
      if (!res.finished) {
        if (pipe) {
          proxyRes.pipe(res);
        }
        else {
          if (proxyRes.responseUrl !== proxyRes.url) {
            console.log('redirect exists');
            res.set('Redirect-To', proxyRes.responseUrl);
          }
          res.end();
        }
      }
    })
    .on('error', () => {
      res.status(500).send('Proxy failed');
    })
    .end();
  
  if (pipe) {
    req.pipe(proxyReq);
  }
  return proxyReq;
}

app.get('/get/:url', checkUrl, (req, res) => {
  const location = req.options.location;
  
  const allowedHosts = [
    'phishing.army',
    'raw.githubusercontent.com'
  ];
  
  if (allowedHosts.indexOf(location.hostname) === -1) {
    return res.status(403)
      .send('Forbidden url');
  }
  
  proxyRequest(location, req, res, { http, https }, true);
});

app.get('/follow/:url', checkUrl, (req, res) => {
  const location = req.options.location;
  
  proxyRequest(location, req, res, followRedirects, false);  
});

app.listen(3000, () => {
  console.log('Proxy listening on port 3000')
})