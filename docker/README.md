To start the container directly from the Docker hub:
```
docker run  -p 8080:8080 -p 1883:1883 -t seriousme/chahasy
```

Now connect your browser to your Dockerhost at port 8080 e.g.: http://dockerhost:8080/

To build a docker container yourself use:
```
docker build --rm -t seriousme/chahasy -f docker/Dockerfile https://github.com/seriousme/Chahasy.git
```



