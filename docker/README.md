To build a docker container use:
```
docker build --rm -t seriousme/chahasy -f docker/Dockerfile https://github.com/seriousme/Chahasy.git
```

To start the container use:
```
docker run -t seriousme/chahasy -p 8080:8080 -p 1883:1883
```

Now connect your browser to your Dockerhost at port 8080 e.g.: http://dockerhost:8080/