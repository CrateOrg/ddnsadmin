<?php
  // *** PHP script to automate nsupdate calls for dynamic dns updates.
  // *** This script and a properly configured bind nameserver allows hosting
  // *** of custom dyndns services, e.g. updating own domain from Fritzbox.
  // *** usage: http://192.168.0.25/nsupdate.php?ns=ns0.mynameserver.de&domain=my.domain.de;my.domain2.de&newip=<ipaddr>  

  if (!isset($_SERVER['PHP_AUTH_USER']))
  {
        Header("WWW-Authenticate: Basic realm=\"Configurations-Editor\"");
        Header("HTTP/1.0 401 Unauthorized");
        echo "Sie m&uuml;ssen sich autentifizieren\n";
        exit;
  }


  // configuration of user and domain
  // Caution: This script validates only given usernames from basic auth and no pw right now.
  $user_domain = array( 'user123' => array('my.domain.de', 'my.domain2.de', 'my.domain.de;my.domain2.de'));

  // short sanity check for given IP
  function checkip($ip)
  {
    $iptupel = explode(".", $ip);
    foreach ($iptupel as $value)
    {
      if ($value < 0 || $value > 255)
        return false;
      }
    return true;
  }

  function nsupdate($dyndns, $subdomain, $ip) {
     // prepare command
     $data = "<<EOF
     server $dyndns
     update delete $subdomain A
     update add $subdomain 10 A $ip
     send
     EOF";
     // run DNS update
     exec("/usr/bin/nsupdate -k /etc/named/K$subdomain*.private $data", $cmdout, $ret);
     return $ret;
  }

  // retrieve remote IP
  $remoteip = $_SERVER['REMOTE_ADDR'];
  // retrieve user
  if ( isset($_SERVER['REMOTE_USER']) )
  {
    $user = $_SERVER['REMOTE_USER'];
  }
  else if ( isset($_SERVER['PHP_AUTH_USER']) )
  {
    $user = $_SERVER['PHP_AUTH_USER'];
  }
  else
  {
    syslog(LOG_WARN, "No user given by connection from $remoteip");
    echo "No user given by connection from $remoteip\n";
    exit(0);
  }

  // open log session
  openlog("DDNS-Provider", LOG_PID | LOG_PERROR, LOG_LOCAL0);
  
  // check for given nameserver
  if ( isset($_POST['ns']) )
  {
    $dyndns = $_POST['ns'];
  }
  else if ( isset($_GET['ns']) )
  {
    $dyndns = $_GET['ns'];
  }
  else
  {
    syslog(LOG_WARN, "User $user didn't provide any dyndns server");
    echo "Error! No dyndns server given.\n";
    exit(0);
  }

  // check for given domain
  if ( isset($_POST['domain']) )
  {
    $subdomain = $_POST['domain'];
  }
  else if ( isset($_GET['domain']) )
  {
    $subdomain = $_GET['domain'];
  }
  else
  {
    syslog(LOG_WARN, "User $user didn't provide any domain");
    echo "Error! No domain name given.\n";
    exit(0);
  }

  // check for given newip
  if ( isset($_POST['newip']) )
  {
    $ip = $_POST['newip'];
  }
  else if ( isset($_GET['newip']) )
  {
    $ip = $_GET['newip'];
  }
  else
  {
    syslog(LOG_WARN, "User $user didn't provide any newip");
    echo "Error! No newip given.\”";
    exit(0);
  }

  // check for needed variables
  if ( isset($subdomain) && isset($ip) && isset($user) )
  {
    // short sanity check for given IP
    if ( preg_match("/^(\d{1,3}\.){3}\d{1,3}$/", $ip) && checkip($ip) && $ip != "0.0.0.0" && $ip != "255.255.255.255" )
    {
      // short sanity check for given domain
      if ( preg_match("/^[\w\d;-_\*\.]+$/", $subdomain) )
      {
        // check whether user is allowed to change domain
        if ( in_array("*", $user_domain[$user]) or in_array($subdomain, $user_domain[$user]) )
        {
          if ( $subdomain != "-" )
            $subdomain = $subdomain . '.';
          else
            $subdomain = '';

          // shell escape all values
          $subdomain = escapeshellcmd($subdomain);
          $user = escapeshellcmd($user);
          $ip = escapeshellcmd($ip);

          $arrsubdomain = explode("\;", $subdomain);
         
          foreach ($arrsubdomain as $value) { 
             // run DNS update
             $subdomain = $value;
             $ret = nsupdate($dyndns, $subdomain, $ip);
             // check whether DNS update was successful
             if ($ret != 0)
             {
               syslog(LOG_INFO, "Changing DNS for $subdomain to $ip failed with code $ret");
               echo "Changing $dyndns DNS for $subdomain to $ip failed with code $ret\n";
             }
             else {
               syslog(LOG_INFO, "Domain $subdomain was successfully updated to $ip. From $user with remote ip $remoteip on nameserver $dyndns");
    echo "Domain $subdomain was successfully updated to $ip. From $user with remote ip $remoteip on nameserver $dyndns\n<br/>";
             }
          }
        }
        else
        {
          syslog(LOG_INFO, "Domain $subdomain is not allowed for $user from remote $remoteip");
          echo "Domain $subdomain is not allowed for $user from remote $remoteip\n";
        }
      }
      else
      {
        syslog(LOG_INFO, "Domain $subdomain for $user from remote ip $ip with $subdomain was wrong with $ip");
        echo "Domain $subdomain for $user from remote ip $ip with $subdomain was wrong with $ip\n";
      }
    }
    else
    {
      syslog(LOG_INFO, "IP $ip for $user from remote $remoteip with $subdomain was wrong");
      echo "IP $ip for $user from remote $remoteip with $subdomain was wrong\n";
    }
  }
  else
  {
    syslog(LOG_INFO, "DDNS change for $user from remote ip $remoteip with $ip and $subdomain failed because of missing values");
    echo "DDNS change for $user from remote ip $remoteip with $ip and $subdomain failed because of missing values\n";
  }

  // close log session
  closelog();
?>