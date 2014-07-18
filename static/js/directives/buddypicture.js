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
define(['jquery', 'underscore', 'text!partials/buddypicture.html'], function($, _, template) {

	return ["$compile", function($compile) {

		var controller = ['$scope', 'safeApply', '$timeout', '$q', function($scope, safeApply, $timeout, $q) {

			// Buddy picutre capture size.
			$scope.captureSize = {
				width: 128,
				height: 128
			};

			$scope.showTakePicture = false;
			$scope.waitingForPermission = false;
			$scope.previewPicture = false;
			$scope.countingDown = false;
			$scope.video = null;
			$scope.canvasPic = null;
			$scope.canvasPrev = null;

			var localStream = null;
			var delayToTakePicture = 3000;
			var countDownFrom = 3;

			// Counts down from start to 1
			var takePictureCountDown = function(start, delayTotal) {
				$scope.countingDown = true;
				$scope.countdown = {};
				$scope.countdown.num = start;
				var decrementNum = function(num) {
					$timeout(function() {
						$scope.countdown.num--;
						if($scope.countdown.num === 0) {
							$scope.countingDown = false;
						}
					}, delayTotal/start*num);
				};
				for (var i = 1; i <= start; i++) {
					decrementNum(i);
				}
			};

			var writeVideoToCanvas = function(canvas) {

				var videoWidth = $scope.video.videoWidth;
				var videoHeight = $scope.video.videoHeight;
				var aspectRatio = videoWidth/videoHeight;
				if (!aspectRatio) {
					// NOTE(longsleep): In Firefox the video size becomes available at sound point later - crap!
					console.warn("Unable to compute aspectRat§io", aspectRatio);
					aspectRatio = 1.3333333333333333;
				}
				var height = canvas.height;
				var width = canvas.width;
				var x = 0;
				var y = 0;
				if (aspectRatio >= 1) {
					x = (width - (width * aspectRatio)) / 2;
					width = width * aspectRatio;
				} else {
					y = (height - (height * (1/aspectRatio))) / 2;
					height = height * aspectRatio;

				}
				canvas.getContext("2d").drawImage($scope.video, x, y, width, height);

			}

			var writePreviewPic = function() {
				writeVideoToCanvas($scope.canvasPrev);
				$scope.preview = $scope.canvasPrev.toDataURL("image/jpeg");
			};

			var makePicture = function(stream, cntFrom, delayTotal) {
				takePictureCountDown(cntFrom, delayTotal);
				$timeout(function() {
					$scope.flash.addClass("flash");
					$timeout(function() {
						$scope.flash.removeClass("flash");
					}, 70);
					videoStop(stream, $scope.video);
					writePreviewPic();
					$scope.previewPicture = true;
				}, delayTotal);
			};

			var videoStop = function(stream, video) {
				if (stream) {
					video.pause();
					stream.stop();
					stream = null;
				}
			};

			var videoStart = function() {
				$scope.waitingForPermission = true;
				var videoConstraints = true;
				var videoAllowed = $q.defer();
				if ($scope.user.settings.cameraId) {
					videoConstraints = {
						optional: [{
							sourceId: $scope.user.settings.cameraId
						}]
					};
				}
				getUserMedia({
					video: videoConstraints
				}, function(stream) {
					$scope.showTakePicture = true;
					localStream = stream;
					$scope.waitingForPermission = false;
					attachMediaStream($scope.video, stream);
					safeApply($scope);
					videoAllowed.resolve(true);
				}, function(error) {
					console.error('Failed to get access to local media. Error code was ' + error.code);
					$scope.waitingForPermission = false;
					safeApply($scope);
					videoAllowed.resolve(false);
				});
				return videoAllowed.promise;
			};

			$scope.initPicture = function() {
				videoStart(localStream);
			};

			$scope.cancelPicture = function() {
				$scope.showTakePicture = false;
				$scope.previewPicture = false;
				videoStop(localStream, $scope.video);
			};

			$scope.retakePicture = function() {
				var permission = videoStart(localStream);
				permission.then(function(isPermitted) {
					if(isPermitted) {
						$scope.previewPicture = false;
						makePicture(localStream, countDownFrom, delayToTakePicture);
					}
				});
			};

			$scope.takePicture = function() {
				makePicture(localStream, countDownFrom, delayToTakePicture);
			};

			$scope.setAsProfilePicture = function() {
				writeVideoToCanvas($scope.canvasPic);
				$scope.user.buddyPicture = $scope.canvasPic.toDataURL("image/jpeg");
				//console.info("Image size", $scope.user.buddyPicture.length);
				$scope.cancelPicture();
				safeApply($scope);
			};

		}];

		var link = function($scope, $element) {

			$scope.video = $element.find("video").get(0);
			$scope.flash = $element.find(".videoFlash");
			$scope.canvasPic = $element.find("canvas.videoPic").get(0);
			$scope.canvasPrev = $element.find("canvas.videoPrev").get(0);
			$($scope.canvasPic).attr($scope.captureSize);

		};

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
