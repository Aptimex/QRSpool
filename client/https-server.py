#!/usr/bin/env python3

# Python3 HTTPS Simple Server
# Taken from https://gist.github.com/stephenbradshaw/a2b72b5b58c93ca74b54f7747f18a481

# First create a basic self-signed certificate using openssl: 
#     openssl req -new -x509 -keyout server.pem -out server.pem -days 365 -nodes

# DO NOT EXPOSE THIS SERVER TO THE INTERNET UNLESS YOU UNDERSTAND THE SECURITY RISKS

import http.server
import ssl

bind = "0.0.0.0"
port = 4443

httpd = http.server.HTTPServer((bind, port), http.server.SimpleHTTPRequestHandler)
ctx = ssl.create_default_context(ssl.Purpose.CLIENT_AUTH)
ctx.load_cert_chain(certfile='./server.pem')
httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
print(f"Starting server on {bind}:{port}")
httpd.serve_forever()
