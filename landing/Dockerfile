FROM nginx:alpine
COPY *.html /usr/share/nginx/html/
COPY favicon.ico /usr/share/nginx/html/
COPY icon.png /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
