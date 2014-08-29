/*
 * Spreed WebRTC.
 * Copyright (C) 2013-2014 struktur AG
 *
 * This file is part of Spreed WebRTC.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 */
define([], function() {

	// ContactsmanagerController
	return ["$scope", "$modalInstance", "contactData", "data", "contacts", 'buddyData', function($scope, $modalInstance, contactData, data, contacts, buddyData) {
		$scope.header = data.header;
		$scope.contacts = [];
		$scope.search = {};
		$scope.contact = null;
		$scope.buddySyncable = false;

		var tmp = {
			displayName: data.contact ? data.contact.Status.displayName : null
		};
		var setContactInfo = function(contact) {
			contacts.update(contact.Userid, contact.Status);
		};
		var updateContacts = function(async) {
			if (async) {
				$scope.$apply(function(scope) {
					scope.contacts = contactData.getAll();
				});
			} else {
				$scope.contacts = contactData.getAll();
			}
		};
		updateContacts();
		contacts.e.on('contactadded', function() {
			updateContacts(true);
		});
		contacts.e.on('contactupdated', function() {
			updateContacts(true);
		});

		// Values to check include 0, so check for number to get around incorrect 'false' type conversion
		if (angular.isNumber(data.contactIndex)) {
			$scope.contact = $scope.contacts[data.contactIndex];
			var scope = buddyData.lookup($scope.contact.Userid, false, false);
			if(scope) {
				var session = scope.session.get();
				$scope.buddySyncable = session.Type ? true : false;
			}
		}

		$scope.removeContact = function() {
			contacts.remove($scope.contact.Userid);
			updateContacts();
			$modalInstance.close();
		};

		$scope.syncContactInfo = function() {
			var scope = buddyData.lookup($scope.contact.Userid, false, false);
			if(scope) {
				var session = scope.session.get();
				$scope.contact.Status.displayName = session.Status.displayName;
			}
		};

		$scope.save = function() {
			setContactInfo($scope.contact);
			$modalInstance.close();
		};

		$scope.cancel = function(contact) {
			$scope.contact.Status.displayName = tmp.displayName;
			$modalInstance.dismiss();
		};

		$scope.edit = function(index) {
			$scope.$broadcast('openEditContact', index);
		};
	}];

});
