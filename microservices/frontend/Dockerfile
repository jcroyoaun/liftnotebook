FROM nginx:alpine

# Copy the frontend files
COPY index.html /usr/share/nginx/html/
COPY css/ /usr/share/nginx/html/css/
COPY js/ /usr/share/nginx/html/js/

# Copy nginx configuration 
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Create a health check endpoint
RUN echo "OK" > /usr/share/nginx/html/health

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
