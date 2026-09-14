server {
    server_name asche.rammwiki.mrzetti.com;
    root /var/www/asche;
    index index.html;
    server_tokens off;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header Cross-Origin-Opener-Policy same-origin always;
    add_header Cross-Origin-Embedder-Policy require-corp always;
    # same-site lets the sibling Flashcards desktop frame the game; genuinely
    # different sites still cannot load it.
    add_header Cross-Origin-Resource-Policy same-site always;

    location / {
        try_files $uri $uri/ =404;
    }

    listen [::]:443 ssl; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/asche.rammwiki.mrzetti.com/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/asche.rammwiki.mrzetti.com/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot

}
server {
    if ($host = asche.rammwiki.mrzetti.com) {
        return 301 https://$host$request_uri;
    } # managed by Certbot


    listen 80;
    listen [::]:80;
    server_name asche.rammwiki.mrzetti.com;
    return 404; # managed by Certbot


}
