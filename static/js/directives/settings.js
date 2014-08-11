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
define(['jquery', 'underscore', 'text!partials/settings.html'], function($, _, template) {

	return ["$compile", "mediaStream", function($compile, mediaStream) {

		var controller = ['$scope', 'desktopNotify', 'mediaSources', 'safeApply', 'availableLanguages', 'translation', 'localStorage', 'dialogs', 'userSettingsData', function($scope, desktopNotify, mediaSources, safeApply, availableLanguages, translation, localStorage, dialogs, userSettingsData) {

			$scope.layout.settings = false;
			$scope.showAdvancedSettings = true;
			$scope.rememberSettings = true;
			$scope.desktopNotify = desktopNotify;
			$scope.mediaSources = mediaSources;
			$scope.availableLanguages = [{
				code: "",
				name: translation._("Use browser language")
			}];
			$scope.withUsers = mediaStream.config.UsersEnabled;
			$scope.withUsersRegistration = mediaStream.config.UsersAllowRegistration;
			$scope.withUsersMode = mediaStream.config.UsersMode;
			$scope.contactsManager = contactsManager;

			_.each(availableLanguages, function(name, code) {
				$scope.availableLanguages.push({
					code: code,
					name: name
				});
			});

			// Make sure to save settings when they are open and the page is reloaded.
			$(window).on("unload", function() {
				if ($scope.layout.settings) {
					$scope.saveSettings();
				}
			});

			$scope.saveSettings = function() {
				var user = $scope.user;
				$scope.update(user);
				$scope.layout.settings = false;
				if ($scope.rememberSettings) {
					userSettingsData.save(user);
					localStorage.setItem("mediastream-language", user.settings.language || "");
				} else {
					userSettingsData.clear();
					localStorage.removeItem("mediastream-language");
					localStorage.removeItem("mediastream-access-code");
				}
			};

			$scope.cancelSettings = function() {
				$scope.reset();
				$scope.layout.settings = false;
			};

			$scope.requestDesktopNotifyPermission = function() {
				$scope.desktopNotify.requestPermission(function() {
					safeApply($scope);
				});
			};

			$scope.openContactsManager = function() {
				var dlgMain = null;
				var dlgEdit = null;

				var main = function() {
					return dialogs.create(
						"/contactsmanager/main.html",
						"ContactsmanagerController",
						{
							header: translation._("Contacts Manager")
						}, {
							wc: "contactsmanager"
						}
					);
				};

				var edit = function(contact) {
					return dialogs.create(
						"/contactsmanager/edit.html",
						"ContactsmanagerController",
						{
							header: translation._("Edit Contact"),
							contact: contact,
						}, {
							wc: "contactsmanager"
						}
					);
				};

				function setupContactsManager() {
					dlgMain = main();
					dlgMain.result.then(function(contact) {
						if(contact && contact.Id) {
							setupContactsManagerEdit(contact);
						}
					});
				}
				function setupContactsManagerEdit(contact) {
					dlgEdit = edit(contact);
					dlgEdit.result.finally(function(final) {
						setupContactsManager();
					});
				}
				setupContactsManager();
			};

			$scope.checkDefaultMediaSources = function() {
				if ($scope.master.settings.microphoneId && !$scope.mediaSources.hasAudioId($scope.master.settings.microphoneId)) {
					$scope.master.settings.microphoneId = null;
				}
				if ($scope.master.settings.cameraId && !$scope.mediaSources.hasVideoId($scope.master.settings.cameraId)) {
					$scope.master.settings.cameraId = null;
				}
				var audio = $scope.mediaSources.audio;
				var video = $scope.mediaSources.video;
				if (!$scope.master.settings.microphoneId && audio.length > 0) {
					$scope.master.settings.microphoneId = audio[0].id;
				}
				if (!$scope.master.settings.cameraId && video.length > 0) {
					$scope.master.settings.cameraId = $scope.mediaSources.video[0].id;
				}
				//console.log("master sources updates", $scope.master);
				$scope.refreshWebrtcSettings();
			};

			$scope.mediaSources.refresh(function() {
				safeApply($scope, $scope.checkDefaultMediaSources);
			});

			$scope.$watch("layout.settings", function(showSettings, oldValue) {
				if (showSettings) {
					$scope.desktopNotify.refresh();
					$scope.mediaSources.refresh(function(audio, video) {
						safeApply($scope, function(scope) {
							if ($scope.user.settings.microphoneId && !$scope.mediaSources.hasAudioId($scope.user.settings.microphoneId)) {
								$scope.user.settings.microphoneId = null;
							}
							if ($scope.user.settings.cameraId && !$scope.mediaSources.hasVideoId($scope.user.settings.cameraId)) {
								$scope.user.settings.cameraId = null;
							}
							if (!$scope.user.settings.microphoneId && audio.length > 0) {
								$scope.user.settings.microphoneId = audio[0].id;
							}
							if (!$scope.user.settings.cameraId && video.length > 0) {
								$scope.user.settings.cameraId = video[0].id;
							}
						});
					});
				} else if (!showSettings && oldValue) {
					$scope.saveSettings();
				}
			});

		}];

		var link = function($scope, $element) {};

		return {
			scope: true,
			restrict: 'E',
			replace: true,
			template: template,
			controller: controller,
			link: link
		};

	}];

});
