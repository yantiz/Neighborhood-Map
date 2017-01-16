// ======< Model >======
var RamenShop = function(place) {
  // Attributes from Google Maps:
  this.name = ko.observable(place.name);
  this.image_url = ko.observable(place.photos[0].getUrl({'maxWidth': 200, 'maxHeight': 100}));
  this.formatted_address = ko.observable(place.formatted_address);
  this.lat = ko.observable(place.geometry.location.lat());
  this.lng = ko.observable(place.geometry.location.lng());
  this.id = ko.observable(place.id);
  this.rating = ko.observable(place.rating);

  // Attributes about the shop's marker:
  this.marker = ko.observable();
  this.getVisible = ko.observable();
 
  // Attributes from Foursquare:
  this.phone = ko.observable();
  this.menuUrl = ko.observable();
};
RamenShop.prototype.addMarker = function(marker) {
  this.marker(marker);
  this.getVisible(marker.getVisible());
};


// ======< ViewModel >======
function ViewModel() {
  // The variable 'self' always refers to the ViewModel itself.
  // This allows us to get access to the ViewModel no matter what context we are in.
  var self = this;

  self.keyword = ko.observable('');
  self.shops = ko.observableArray();

  self.addShop = function(name) {
    self.shops().push(name);
  };

  self.setMarkerVisibility = function(shop, visibility) {
    shop.marker().setVisible(visibility);
    shop.getVisible(shop.marker().getVisible());
  };

  self.filterShops = function() {
    // Close potential orphan infowindow
    infowindow.close();

    var keyword = self.keyword().toLowerCase();

    self.shops().forEach(function(shop) {
      if (keyword) {
        
        self.setMarkerVisibility(shop, false);
        if (shop.name().toLowerCase().indexOf(keyword) !== -1) {
          self.setMarkerVisibility(shop, true);
        }
      }
      else {
        self.setMarkerVisibility(shop, true);
      }
    });
  };

  self.triggerMarker = function(shop) {
    google.maps.event.trigger(shop.marker(), 'click');
  };
}
vm = new ViewModel();


// ======< The app's code >======

// Constant settings
var map = null;
var service;
var infowindow;

// API keys for Foursquare
var CLIENT_ID = 'LEJTDC2PT4YVM1JZ5IOFWK35PB54ZBTH4BNCREQQWYIFGKGY';
var CLIENT_SECRET = 'ZEWB0YZB4ZBQEAZ23ZGEXORK0KYI34YYDL34QGD3X0RPRLLO';

// Error handling after 5 seconds in case of failing to initialize the map
setTimeout(function() {
  if (!map) {
    document.getElementById('map').innerHTML = "<h1>Failed to initialize the map, please check your Internet connection.</h1>";
  }
}, 5000);

function initMap() {
  var LA_downtown = new google.maps.LatLng(34.0407, -118.2468);

  map = new google.maps.Map(document.getElementById('map'), {
    center: LA_downtown,
    zoom: 10
  });

  var request = {
    location: LA_downtown,
    radius: '50000',
    query: 'ramen shop'
  };

  service = new google.maps.places.PlacesService(map);
  service.textSearch(request, callback);

  infowindow = new google.maps.InfoWindow();
}

function callback(results, status) {
  if (status == google.maps.places.PlacesServiceStatus.OK) {
    for (var i = 0; i < results.length; i++) {
      var shop = new RamenShop(results[i]);

      vm.addShop(shop);

      var marker = new google.maps.Marker({
        position: {lat: shop.lat(), lng: shop.lng()},
        map: map
      });

      // Add the marker to our RamenShop model object
      shop.addMarker(marker);
    }
    vm.shops().forEach(function(shop) {
      var foursquare_response = '';

      // Make AJAX request to Foursquare's search API
      $.ajax({
        url: 'https://api.foursquare.com/v2/venues/search?client_id=' + CLIENT_ID + '&client_secret=' + CLIENT_SECRET + '&v=20130815&ll=' + shop.lat() + ',' + shop.lng() +
          '&query=' + encodeURI(shop.name()),
        dataType: 'json',
        success: function(data) {
          var result = data.response.venues[0];

          // Retrieve phone number and menu from Foursquare if available
          // Otherwise inform the user that the information is unavailable
          if (result.contact.formattedPhone) {
            shop.phone(result.contact.formattedPhone);
            foursquare_response += '<p>Phone: ' + result.contact.formattedPhone + '</p>';
          }
          else {
            foursquare_response += '<p style="color: red">Unable to get the phone number of this shop.</p>';
          }
          if (result.menu) {
            shop.menuUrl(result.menu.url);
            foursquare_response += '<p><a target="blank" href="' + result.menu.url + '">Menu</a></p>';
          }
          else {
            foursquare_response += '<p style="color: red">Unable to get the menu of this shop.</p>';
          }
        },
        error: function() {
          // Error handling in case of failing to connect to Foursquare's API
          foursquare_response += "<h5 style='color: red'>Failed to retrieve information from Foursquare.</h5>";
        }
      });

      shop.marker().addListener('click', function() {
        infowindow.close();
        infowindow.setContent(
            '<h4>' + shop.name() + '</h4>' +
            '<img src="' + shop.image_url() + '">' + '<br><br>' +
            '<p>' + shop.formatted_address() + '</p>' +
            '<p>' + 'Rating: ' + shop.rating() + '</p>' +
            foursquare_response
        );
        infowindow.open(map, this);

        // If being clicked, let the marker bounce and have it rested again after 1.4 seconds
        this.setAnimation(google.maps.Animation.BOUNCE);
        setTimeout(function () {
          this.setAnimation(null);
        }.bind(this), 1400);
      });
    });
  }
  else {
    // Error handling in case of failing to connect to Google's API
    document.getElementById('map').innerHTML = "<h1>Failed to retrieve information from Google Maps.</h1>";
  }
  // Make sure the ViewModel initializes itself after loading Google Maps and retrieving information from Foursquare
  ko.applyBindings(vm);
}
