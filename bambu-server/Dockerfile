FROM python:3

RUN apt-get update
RUN apt-get install -y openssl inetutils-ping

WORKDIR /bambu-server
COPY requirements.txt /bambu-server/requirements.txt
RUN pip install -r requirements.txt

# Cert goes to /certs/ so it isn't shadowed by the code volume mount
RUN mkdir /certs && openssl req -new -x509 -subj "/CN=bambu-api-server.local" -keyout /certs/server.key -out /certs/server.crt -days 3650 -nodes

ENV PYTHONUNBUFFERED=1

# HTTPS listening on port 5123
#CMD ["flask", "run", "--host=0.0.0.0", "--port=5123", "--cert=/certs/server.crt", "--key=/certs/server.key"]

# HTTP lsitening on port 5123
CMD ["flask", "run", "--host=0.0.0.0", "--port=5123"]