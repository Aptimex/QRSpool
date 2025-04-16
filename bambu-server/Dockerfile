FROM python3

RUN apt-get update

WORKDIR /bambu-server
COPY ./* /bambu-server
RUN pip install requirements.txt

CMD flask run --host=0.0.0.0 --cert=cert.pem --key=key.pem