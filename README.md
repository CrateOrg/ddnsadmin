DDNSadmin
=========

This is a web interface for DNS zone management using TSIG keys (RFC2845). To 
use it you must have a valid TSIG key and configure your DNS zone master 
name server to allow AXFR and DDNS requests signed by your key.

In addition to the web frontend for human users there is a HTTP(S) based "API"
for routers.

DNS management interface is split in two parts - frontend written in JavaScript 
and backend written in PHP.

Backend is completely stateless and is used only to convert HTTP requests to DNS
queries. Single backend can be safely used by multiple users managing different 
DNS zones.


Installation
------------

* Install a web server and php stack on your machine, for example

  `apt install -y lamp-server^`

* Install Git

  `apt install -y git`

* Clone repository

  `git clone <REPO_URL> /var/www/html`

* Install composer

  `curl -sS https://getcomposer.org/installer -o composer-setup.php`
  
  `php composer-setup.php; rm composer-setup.php`
  
  `mv composer.phar /usr/local/bin/composer`

* Install dependencies

  `cd /var/www/html; composer install`

To try it out on local machine without a full blown web server you can use PHP built-in web server. Start it from this project directory, with:

`php -S 127.0.0.1:8080`

And point your browser to http://127.0.0.1:8080/.

Security remark: While this project does not cache any sensitive data by itself remind yourself that any sensitive data might be recorded by your website hoster.

Security remark: While this project does not cache any sensitive data by itself
remind yourself that any sensitive data might be recorded by your website hoster.


Frontend settings
-----------------

Backend does not require any initial setup and can be used as it is. On the 
frontend user have following settings:

* **DNS zone** - Domain name of zone that is being managed, example: 
*example.net*
* **Key name** - Name of key that is used to sign DNS requests, must be the 
identical to the key name configured on a DNS server, example: 
*key.example.net.*
* **Key type** - Algorithm that is used to generate signature, must be the same 
as configured on a DNS server, example: *sha512*
* **Key** - Secret key used to sign requests, must be base64 encoded, example: 
*UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw=*

Advanced settings:

* **DNS Server** - IP address of zone master name server. DNS requests are 
being sent to this address. This field is filled usually automatically after 
**DNS zone** is entered. It can be entered manually if system fails to detect 
it automatically.
* **Proxy URL** - Backend URL (relative or absolute). Default is search for 
backend on the same web server, same directory. It should be changed if backend 
and frontend are on different web servers.
* **Filter RRs** - List of resource record types (comma separated) to filter 
out before displaying zone records.


System architecture
-------------------

User frontend files:

* index.html
* ddnsadmin.js
* node_modules

Router/Endpoint fronted file:

* nsupdate.php

Backend files:

* dnsproxy.php
* composer.json
* composer.lock
* vendor

```
+--------------+         +--------------+      +------------+
|              | HTTP/S  |              | DNS  |            |
| Web browser  |-------->| PHP backend  |----->| Master     |
|              |         |              |      | Nameserver |
| index.html   |<--------| dnsproxy.php |<-----|            |
| ddnsadmin.js |    ^    | Net.phar     |   ^  |            |
+--------------+    |    +--------------+   |  +------------+
                    |                       |
   JSON request over HTTP (key is send      |
   in plaintext here, except for HTTPS)     |
                                            |
                           Signed DNS request (AXFR or DNS update)
                       (key is not sent here, only request signature)
```

In each request frontend passes your zone key to the backend. It is important 
to use HTTPS or start backend on your local machine using PHP built-in web 
server to avoid eavesdropping. But you must yet trust your website hoster.


Net\_DNS2
---------

Backend uses [Net\_DNS2 library](http://pear.php.net/package/Net\_DNS2) for DNS 
packet crafting. This repository uses composer to manage Net\_DNS2 library
files.

DNS server configuration examples
=================================


Key generation
--------------

Generate a new random key (256 bit length) and base64 encode it:

	$ dd if=/dev/urandom bs=32 count=1 2>/dev/null | base64
	UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw=

In the examples below we will use sha512 HMAC algorithm and will name our key 
**uberkey**.

TSIG key information summary:

> Key name: **uberkey**
>
> Key type: **hmac-sha512**
>
> Key: **UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw=**


Bind 9 DNS server
-----------------

Bind 9 configuration snippet for "example.net" zone:

	key uberkey {
		algorithm hmac-sha512;
		secret "UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw=";
	};
	zone "example.net" {
		type master;
		file "/etc/bind/db.example.net";
		allow-transfer { key uberkey; };
		allow-update { key uberkey; };
	};


PowerDNS server configuration
-----------------------------

Zone transfer (AXFR) with TSIG key is supported since PowerDNS server 3.0.
[Documentation](http://doc.powerdns.com/html/tsig.html).

DDNS updates with TSIG key is supported since PowerDNS server 3.4.
[Documentation](http://doc.powerdns.com/html/rfc2136.html).


Knot DNS server
---------------

Knot configuration snippet for "example.net" zone:

	keys {
	  uberkey hmac-sha512 "UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw=";
	}
	remotes {
	  any-with-key {
	    address 0.0.0.0/0;
	    key uberkey;
	  }
	}
	zones {
	  example.net {
	    file "/etc/knot/example.net.zone";
	    xfr-out any-with-key;
	    update-in any-with-key;
	  }
	}


YADIFA DNS server
-----------------

YADIFA configuration snippet for "example.net" zone:

	<key>
		name       uberkey
		algorithm  hmac-md5
		secret     UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw=
	</key>
	<zone>
		type            master
		domain          example.net
		file            example.net.zone
		allow-transfer  key uberkey
		allow-update    key uberkey
	</zone>

**Note!** YADIFA 1.0.3 supports only hmac-md5 TSIG key algorithm!


Configuration testing
---------------------

To test your name server configuration you can perform AXFR queries using 
**dig** tool and DDNS updates using **nsupdate** tool.

Perform AXFR using **dig**:

	$ dig -y hmac-sha512:uberkey:UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw= -t axfr example.net @127.0.0.1

Perform DDNS update using **nsupdate**:

	$ nsupdate -y hmac-sha512:uberkey:UNhY4JhezH9gQYqvDMWrWH9CwlcKiECVqejMrND2VFw=
	> server 127.0.0.1
	> zone example.net
	> update add ddnstest.example.net 300 IN A 192.0.2.1
	> send
	> quit

If **nsupdate** do not print any error messages it means DDNS update was 
performed successfully.

In both examples replace *127.0.0.1* with your name server IP address.

Router/Endpoint Frontend
------------------------

http://127.0.0.1:8080/nsupdate.php?zone=example.net&key-name=host.example.net&key-type=hmac-sha512&key=<base64-encoded-key>--&server=5.189.123.456&name=host.example.net&ttl=60&type=A
