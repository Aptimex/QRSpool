FROM python:3

RUN apt-get update
RUN apt-get install -y openssl inetutils-ping

WORKDIR /bambu-server
COPY ./* /bambu-server
RUN pip install -r requirements.txt

# This generates a self-signed cert good for 10 years
RUN openssl req -new -x509 -subj "/C=US/ST=Denial/L=Springfield/O=Dis/CN=www.example.com" -keyout key.pem -out cert.pem -days 3650 -nodes

# HTTPS listening on port 5123
CMD ["flask", "run", "--host=0.0.0.0", "--port=5123", "--cert=cert.pem", "--key=key.pem"]

# HTTP lsitening on port 5123
#CMD ["flask", "run", "--host=0.0.0.0", "--port=5123"]