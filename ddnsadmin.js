var options;
function show_error(str) {
  $("#errors").append(
    '<div class="alert alert-danger alert-dismissible" role="alert"><strong>Error!</strong>' +
      str +
      '<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button></div>'
  );
}

$(document).ready(function () {
  $("#records").DataTable({
    bSortCellsTop: true, // sorting in the first column
    drawCallback: function (oSettings) {
      var perPage = oSettings._iDisplayLength;
      var total = oSettings.fnRecordsTotal();
      var totalPages = Math.ceil(total / perPage);
      var page = oSettings._iDisplayStart / perPage + 1;
      var empty = perPage - (total % perPage);
      var columns = $(this).find("tr").first().find("th").length;

      if (page == totalPages) {
        for (i = 0; i < empty; i++) {
          $(this).append(
            '<tr class="space"><td colspan="' + columns + '">&nbsp;</td></tr>'
          );
        }
      }
      attach_button_action();
    },
    columnDefs: [
      { orderable: false, targets: -1 }, // last column doesn't have sorting option
    ],
    lengthMenu: [
      [5, 10, 25, 50, -1],
      [5, 10, 25, 50, "All"],
    ], // show n rows
    pageLength: 25, // show 10 rows by default
  });

  $("#settings").on("hide.bs.collapse", function () {
    $("#btn-settings").html(
      '<i class="bi bi-caret-down-fill"></i> Show settings'
    );
  });
  $("#settings").on("show.bs.collapse", function () {
    $("#btn-settings").html(
      '<i class="bi bi-caret-up-fill"></i> Hide settings'
    );
  });
});

function get_auth_data(form_element) {
  var data = {};
  $.each(form_element, function (key, val) {
    if (val.name) {
      data[val.name] = val.value;
    }
  });

  return data;
}

function show_buttons(ref, mode) {
  if (mode == "editing") {
    ref.closest("tr").find('[data-name="save-button"] button').show();
    ref.closest("tr").find('[data-name="cancel-button"] button').show();
    ref.closest("tr").find('[data-name="edit-button"] button').hide();
  } else if (mode == "view") {
    ref.closest("tr").find('[data-name="save-button"] button').hide();
    ref.closest("tr").find('[data-name="cancel-button"] button').hide();
    ref.closest("tr").find('[data-name="edit-button"] button').show();
  }
}

function is_fqdn(domain) {
  if (domain.slice(-1) == ".") {
    return true;
  }
  return false;
}

function create_fqdn(domain, html) {
  html = html === undefined ? false : true;
  if (is_fqdn(domain)) {
    return domain;
  } else {
    var auth_data = get_auth_data(document.getElementById("auth_form"));
    var fqdn;
    if (html) {
      if (domain.length == 0) {
        fqdn =
          domain + '<span class="text-muted">' + auth_data.zone + ".</span>";
      } else {
        fqdn =
          domain + '<span class="text-muted">.' + auth_data.zone + ".</span>";
      }
    } else {
      fqdn = domain + "." + auth_data.zone + ".";
    }

    return fqdn;
  }
}

function get_subdomain(domain) {
  var auth_data = get_auth_data(document.getElementById("auth_form"));
  if (is_fqdn(domain)) {
    return domain.slice(-1 * (auth_data.zone.length + 2));
  } else if (domain.slice(-1 * auth_data.zone.length) == auth_data.zone) {
    return domain.replace(domain.slice(-1 * (auth_data.zone.length + 1)), "");
  }

  return domain;
}

function hide_errors() {
  $("#errors").empty();
}

function attach_button_action() {
  $('#records [data-name="delete-button"] button')
    .off("click")
    .on("click", function (e) {
      var record = {};
      e.preventDefault();
      var data = get_auth_data(document.getElementById("auth_form"));

      $(this)
        .closest("tr")
        .find('[data-var="yes"]')
        .each(function () {
          record[$(this).attr("data-name").replace("record-", "")] =
            $(this).text();
        });

      if (
        !confirm(
          "Are you sure you want to delete\n" +
            record["name"] +
            " " +
            record["type"] +
            " " +
            record["data"] +
            "?"
        )
      ) {
        return;
      }

      data["record"] = record;
      $.post(
        $("#proxy-path").val() + "/delete-record",
        JSON.stringify(data),
        reload_zone
      );
    });

  $('#records [data-name="edit-button"] button')
    .off("click")
    .on("click", function (e) {
      $(this)
        .closest("tr")
        .find('[data-var="yes"]')
        .each(function () {
          var dataName = $(this).attr("data-name");

          if (dataName == "record-name") {
            $(this).html(
              '<input type="text" name="' +
                dataName +
                '" class="form-control" value="' +
                $(this).attr("data-original") +
                '">'
            );
          } else if (dataName == "record-type") {
            selectedType = $(this).text();
            $(this).html(
              '<select name="type" class="form-control"><option></option></select>'
            );
            $(this).closest("tr").find("select").html(options.join(""));
            $(this).closest("tr").find("select").val(selectedType);
          } else {
            $(this).html(
              '<input type="text" name="' +
                dataName +
                '" class="form-control" value="' +
                $(this).attr("data-original").replace(/"/g, "&quot;") +
                '">'
            );
          }
        });

      show_buttons($(this), "editing");
    });

  $('#records [data-name="cancel-button"] button')
    .off("click")
    .on("click", function (e) {
      $(this)
        .closest("tr")
        .find('[data-var="yes"]')
        .each(function () {
          var dataName = $(this).attr("data-name");

          if (dataName == "record-name") {
            $(this).html(create_fqdn($(this).attr("data-original"), true));
          } else {
            $(this).html(
              $(this)
                .attr("data-original")
                .replace(/&quot;/g, '"')
            );
          }
        });

      show_buttons($(this), "view");
    });

  $('#records [data-name="save-button"] button')
    .off("click")
    .on("click", function (e) {
      e.preventDefault();
      var data = get_auth_data(document.getElementById("auth_form"));
      var record = { original: {}, new: {} };
      $(this)
        .closest("tr")
        .find('[data-var="yes"]')
        .each(function () {
          var name = $(this).attr("data-name").replace("record-", "");
          var value = $(this).children().first().val();

          if (name == "name") {
            record["original"][name] = create_fqdn(
              $(this).attr("data-original")
            );
            record["new"][name] = create_fqdn(value);
          } else {
            record["original"][name] = $(this)
              .attr("data-original")
              .replace(/&quot;/g, '"');
            record["new"][name] = value;
          }
        });

      show_buttons($(this), "view");

      data["record"] = record;
      $.post(
        $("#proxy-path").val() + "/update-record",
        JSON.stringify(data),
        function (data) {
          if (data.error) {
            show_error(data.message);
          } else {
            reload_zone();
          }
        }
      );
    });

  $(".btn-tooltip").tooltip();
}

function load_reverse_zone() {
  var auth_data = get_auth_data(document.getElementById("auth_form"));
  auth_data.zone = auth_data["rev-zone"];
  update_table(auth_data);
}

function reload_zone() {
  var auth_data = get_auth_data(document.getElementById("auth_form"));
  update_table(auth_data);
}

function update_table(auth_data) {
  var table = $("#records").DataTable();
  table.clear();

  $.ajax({
    type: "POST",
    url: $("#proxy-path").val() + "/axfr",
    data: JSON.stringify(auth_data),
    success: function (data) {
      var body;
      var rr_filter = $("#rr-filter").val().split(",");

      if (data.error) {
        show_error(data.message);
        return;
      }

      body = $("#records > tbody");
      $.each(data.records, function (key, val) {
        var r = new Array();
        var i = 0;

        if ($.inArray(val["type"], rr_filter) != -1) return;

        $.each(val, function (rkey, rval) {
          if (rkey == "name") {
            rval = get_subdomain(rval);
            r[i++] =
              '<td data-name="record-' +
              rkey +
              '" data-var="yes" data-original="' +
              rval +
              '">' +
              create_fqdn(rval, true) +
              "</td>";
          } else if (rkey == "data") {
            r[i++] =
              '<td data-name="record-' +
              rkey +
              '" data-var="yes" data-original="' +
              rval.replace(/"/g, "&quot;") +
              '">' +
              rval +
              "</td>";
          } else {
            r[i++] =
              '<td data-name="record-' +
              rkey +
              '" data-var="yes" data-original="' +
              rval +
              '">' +
              rval +
              "</td>";
          }
        });
        r[i++] = '<td class="col-control">';
        r[i++] =
          '<div data-name="save-button" data-name="buttons" style="display: inline"><button data-original-title="Save changes" type="button" class="btn btn-secondary btn-sm btn-tooltip me-2" style="display: none"><i class="bi bi-check-lg"></i></button></div>';
        r[i++] =
          '<div data-name="cancel-button" data-name="buttons" style="display: inline"><button data-original-title="Cancel changes" type="button" class="btn btn-secondary btn-sm btn-tooltip" style="display: none"><i class="bi bi-x-lg"></i></button></div>';
        r[i++] =
          '<div data-name="edit-button" data-name="buttons" style="display: inline"><button data-original-title="Edit record" type="button" class="btn btn-secondary btn-tooltip btn-sm me-2"><i class="bi bi-pencil-fill"></i></button></div>';
        r[i++] =
          '<div data-name="delete-button" data-name="buttons" style="display: inline"><button data-original-title="Delete record" type="button" class="btn btn-danger btn-tooltip btn-sm"><i class="bi bi-trash-fill"></i></button></div>';
        r[i++] = "</td>";

        var row = $("<tr>").append(r.join(""));
        table.row.add(row);
      });
      table.draw();
    },
    async: false,
  });
}

function connect_to_proxy() {
  $('#rr-add [name="type"]').empty();
  $("#key-type").empty();

  $.post($("#proxy-path").val() + "/ping", "", function (data) {
    $("#proxy-path").closest("div.form-group").removeClass("has-error");
    $("#proxy-path").closest("div.form-group").addClass("has-success");

    $.post(
      $("#proxy-path").val() + "/supported-key-types",
      "",
      function (data) {
        options = new Array();
        Object.keys(data).forEach(function (key) {
          options.push(
            '<option value="' + key + '">' + data[key] + "</option>"
          );
        });
        $("#key-type").append(options.join(""));
        // First when the key-type fields are fetched, it's OK to auto-fill the saved settings
        get_stored_settings();
      }
    );

    $.post($("#proxy-path").val() + "/supported-rr-types", "", function (data) {
      options = new Array();
      Object.keys(data).forEach(function (key) {
        options.push('<option value="' + key + '">' + data[key] + "</option>");
      });
      $('#rr-add [name="type"]').append(options.join(""));
    });
  }).fail(function () {
    $("#proxy-path").closest("div.form-group").addClass("has-error");
    $("#proxy-path").closest("div.form-group").removeClass("has-success");
  });
}

function attach_zone_selectors() {
  $("#btn-loadjson").on("click", function () {
    $("#input-loadjson").trigger("click");
  });

  $("#input-loadjson").on("change", function () {
    var file = this.files[0];
    if (file) {
      var reader = new FileReader();

      reader.onload = function (evt) {
        var data = evt.target.result;
        try {
          // Verify the validity of the file contents
          var jsonData = JSON.parse(data);
          if (jsonData && jsonData.zones) {
            jsonData.zones.forEach((zone) => {
              if (
                !zone["zone"] ||
                !zone["key-name"] ||
                !zone["key-type"] ||
                !zone["key"] ||
                !zone["server"] ||
                !zone["proxy-path"] ||
                !zone["rr-filter"]
              ) {
                throw Error();
              }
            });

            // Store the entire blob, and "autoselect" the first entry in the file
            window.localStorage.setItem("stored_zones", data);
            window.localStorage.setItem(
              "selected_zone",
              jsonData.zones[0]["zone"]
            );

            // Load the newly stored settings
            get_stored_settings();
          } else {
            throw Error();
          }
        } catch (err) {
          show_error("Invalid settings format.");
        }
      };

      if (file.size > 20000) {
        show_error("File is too large.");
      } else {
        data = reader.readAsText(file, "UTF-8");
      }
    }
  });

  $(".dropdown-menu").on("click", "li a", function () {
    configure_for_zone(this.text);
  });
}

function configure_for_zone(zone_name) {
  zone_settings.zones.forEach((zone) => {
    if (zone["zone"] == zone_name) {
      for (var key in zone) {
        try {
          document.getElementById(key).value = zone[key];
        } catch (Err) {}
      }
      // Update zone selector text
      update_zone_selector_button(zone_name);

      // Store the currently selected value as a local storage setting as well
      window.localStorage.setItem("selected_zone", zone_name);
      $("#reload_button").trigger("click");
    }
  });
}

function update_zone_selector_button(text) {
  button = $("#zone_selector button");
  button.html(text + ' <span class="caret"></span>');
}

function get_stored_settings() {
  var stored_zones = window.localStorage.getItem("stored_zones");
  if (stored_zones) {
    zone_settings = JSON.parse(stored_zones);

    // Refresh the zone selector
    $("#zone_selector ul").empty();
    if (zone_settings.zones.length > 0) {
      zone_settings.zones.forEach((zone) => {
        $("#zone_selector ul").append(
          '<li><a  class="dropdown-item" href="#">' + zone["zone"] + "</a></li>"
        );
      });
    } else {
      update_zone_selector_button("No zones");
    }

    // Select the stored zone
    var selected_zone = window.localStorage.getItem("selected_zone");
    configure_for_zone(selected_zone);
  } else {
    update_zone_selector_button("No zones");
  }
}

$(function () {
  $(document).ajaxError(function (event, jqxhr, settings, exception) {
    if (jqxhr.responseText.length > 0) {
      show_error(jqxhr.responseText);
    } else {
      show_error(jqxhr.status + " " + jqxhr.statusText);
    }
  });

  attach_zone_selectors();
  connect_to_proxy();

  $("#proxy-path").on("change", connect_to_proxy);

  $("#zone").on("change", function (e) {
    var data = {};
    data[this.name] = this.value;

    $.post(
      $("#proxy-path").val() + "/zone-to-server",
      JSON.stringify(data),
      function (data) {
        $("#server").val(data.server);
      }
    );
  });

  $("#auth_form").on("submit", function (e) {
    e.preventDefault();
    hide_errors();
    let submitter = e.originalEvent.submitter;
    if (submitter && submitter.name === "reverse_load") {
      load_reverse_zone();
    } else {
      reload_zone();
    }

    if ($("#errors").is(":empty")) {
      $("#settings").collapse("hide");
    }
  });

  $('#records [data-name="add-button"] button').on("click", function (e) {
    e.preventDefault();
    var data = get_auth_data(document.getElementById("auth_form"));
    var record = {};
    $.each(document.getElementById("rr-add"), function (key, val) {
      if (val.name) {
        if (val.name == "name") {
          // if ends with dot, don't append zone
          if (val.value.slice(-1) == ".") {
            record[val.name] = val.value;
          } else {
            record[val.name] =
              val.value + (val.value.length == 0 ? "" : ".") + data.zone;
          }
        } else {
          record[val.name] = val.value;
        }
      }
    });

    data["record"] = record;
    last_data = data; // Global variable for accessing in the result below
    $.post(
      $("#proxy-path").val() + "/add-record",
      JSON.stringify(data),
      function (result) {
        if (result.error) {
          show_error(result.message);
        } else {
          // Add success, try add reverse PTR if configured
          if (
            last_data.record.type == "A" &&
            $("#auto-rev-add").is(":checked") &&
            $("#rev-zone").val().length > 0
          ) {
            var data = JSON.parse(JSON.stringify(last_data));
            data.zone = data["rev-zone"];
            data.record.data = data.record.name + ".";
            data.record.type = "PTR";

            // IP-addres in reverse, dot, rev-zone minus the stuff before in-addr.arpa
            data.record.name =
              last_data.record.data.split(".").reverse().join(".") +
              "." +
              last_data["rev-zone"].split(".").slice(3).join(".");
            $.post(
              $("#proxy-path").val() + "/add-record",
              JSON.stringify(data),
              function (rev_result) {
                if (rev_result.error) {
                  show_error("PTR add failed: " + rev_result.message);
                } else {
                  // Clear input fields on success
                  $("#rr-add").find("input[type=text], textarea").val("");
                  reload_zone();
                }
              }
            );
          } else {
            // Clear input fields on success
            $("#rr-add").find("input[type=text], textarea").val("");
            reload_zone();
          }
        }
      }
    );
  });
});
