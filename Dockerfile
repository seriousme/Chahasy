# Mosca on Alpine 
#
# VERSION 0.1.0

FROM mhart/alpine-node
MAINTAINER Hans Klunder <hans.klunder@bigfoot.com>

RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app/

COPY ./ /usr/src/app/

RUN npm install

EXPOSE 8080
EXPOSE 1883

ENTRYPOINT ["/bin/sh","/usr/src/app/docker/startup.sh"]
