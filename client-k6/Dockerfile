# Use the official K6 image as the base image
FROM grafana/k6:0.52.0

# Set the working directory
WORKDIR /k6

# Copy the K6 script into the container
COPY index.js /k6/index.js

COPY . /k6/


# Run K6 with the provided script
ENTRYPOINT ["k6", "run", "/k6/index.js"]
