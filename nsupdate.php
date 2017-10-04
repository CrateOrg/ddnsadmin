<?php
  // *** PHP script to automate nsupdate calls for dynamic dns updates.
  // *** This script and a properly configured bind nameserver allows hosting
  // *** of custom dyndns services, e.g. updating own domain from Fritzbox.
  // *** usage: http://192.168.0.25/nsupdate.php?ns=ns0.mynameserver.de&domain=my.domain.de&newip=<ipaddr>
  // Taken (and modified) from https://gist.github.com/mark-sch/9109343

  // open log session
  openlog("webnsupdater", LOG_PID | LOG_PERROR, LOG_LOCAL0);

  function output_error($error_string, $status_code = 500) {
    http_response_code($status_code);
    die($error_string);
  }

  function base64_url_encode($input) {
    return strtr(base64_encode($input), '+/=', '._-');
  }

  function base64_url_decode($input) {
    return base64_decode(strtr($input, '._-', '+/='));
  }

  // Load Net/DNS2 library
  if (file_exists('composer.json')) {
    require_once 'vendor/autoload.php';
  } else {
    syslog(LOG_WARN, 'Net_DNS2 PHP library is missing.');
    output_error("Net_DNS2 PHP library is missing.\n");
  }

  // configuration: domains which can be updated, nameservers must be a subdomain of any of those but cross-updates are allowed
  $legitimate_domains = array('example.net', 'example.org');

  // helper function: short sanity check for given IP
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

  // helper function: get a parameter from POST first and then GET
  // $param = name of parameter
  function getparam($param)
  {
      $paramvalue = "";
    if ( isset($_POST[$param]) )
    {
      $paramvalue = $_POST[$param];
    }
    else if ( isset($_GET[$param]) )
    {
      $paramvalue = $_GET[$param];
    }
    else
    {
      syslog(LOG_WARN, "Parameter $param not provided in POST nor GET");
    }
    return $paramvalue;
  }

  // Process request
  foreach (array("zone", "key-name", "key-type", "key", "server") as $val) {
	$args[$val] = getparam($val);
	if (empty($args[$val]))
		output_error('Invalid request, "'.$val.'" field is mandatory.', 400);
  }
  $args["key"] = base64_url_decode($args["key"]);

  $record = $args['record'];
  foreach (array("name", "ttl", "type", "data") as $val) {
	syslog(LOG_WARN, "getparam($val) = ".getparam($val));
	$record[$val] = getparam($val);
	if (empty($record[$val]))
		output_error('Invalid request, "'.$val.'" field is mandatory.', 400);
  }

  $type_name = $record['type'];
  if (empty(Net_DNS2_Lookups::$rr_types_by_name[$type_name]))
	output_error('Resource record type "'.$type_name.'" is not supported.');

  $type_id = Net_DNS2_Lookups::$rr_types_by_name[$type_name];
  if (empty(Net_DNS2_Lookups::$rr_types_id_to_class[$type_id]))
	output_error('Resource record type "'.$type_name.'" is not supported.');

  $type_class = Net_DNS2_Lookups::$rr_types_id_to_class[$type_id];
  $u = new Net_DNS2_Updater($args['zone'], array('nameservers' => array($args['server'])));

  try {
	$u->signTSIG($args['key-name'], $args['key'], $args['key-type']);
	$u->add($type_class::fromString($record['name'].' '.$record['ttl'].' IN '.$record['type'].' '.$record['data']));
	$u->update();
  } catch(Net_DNS2_Exception $e) {
	output_error("Update failed: ".$e->getMessage());
	syslog(LOG_WARN, "Update failed: ".$e->getMessage());
  }

  // close log session
  closelog();
?>
