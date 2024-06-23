'use strict';



/**
 * add event listener on multiple elements
 */

const addEventOnElements = function (elements, eventType, callback) {
  for (let i = 0, len = elements.length; i < len; i++) {
    elements[i].addEventListener(eventType, callback);
  }
}



/**
 * NAVBAR TOGGLE FOR MOBILE
 */

const navbar = document.querySelector("[data-navbar]");
const navTogglers = document.querySelectorAll("[data-nav-toggler]");
const overlay = document.querySelector("[data-overlay]");

const toggleNavbar = function () {
  navbar.classList.toggle("active");
  overlay.classList.toggle("active");
  document.body.classList.toggle("nav-active");
}

addEventOnElements(navTogglers, "click", toggleNavbar);


/**
 * HEADER
 * active header when window scroll down to 100px
 */

const header = document.querySelector("[data-header]");

window.addEventListener("scroll", function () {
  if (window.scrollY > 100) {
    header.classList.add("active");
  } else {
    header.classList.remove("active");
  }
});


/**
 * JS for TOGGLING THE DARK/BRIGHT MODE
 */
const toggleButton = document.getElementById('toggleButton');
const body = document.body;

// Load the saved mode from local storage
const currentMode = 'dark-mode';
body.classList.add(currentMode);

// Update button text based on the current mode
const icon = toggleButton.querySelector('ion-icon');
currentMode === 'dark-mode' ? icon.setAttribute('name', 'moon'): icon.setAttribute('name', 'sunny-outline');
toggleButton.addEventListener('click', () => {
    if (body.classList.contains('dark-mode')) {
        body.classList.replace('dark-mode', 'bright-mode');
        icon.setAttribute('name', 'sunny-outline');
        localStorage.setItem('mode', 'bright-mode');
    } else {
        body.classList.replace('bright-mode', 'dark-mode');
        icon.setAttribute('name', 'moon');
        localStorage.setItem('mode', 'dark-mode');
    }
});


/**
 * SCROLL REVEAL
 */

const revealElements = document.querySelectorAll("[data-reveal]");
const revealDelayElements = document.querySelectorAll("[data-reveal-delay]");

const reveal = function () {
  for (let i = 0, len = revealElements.length; i < len; i++) {
    if (revealElements[i].getBoundingClientRect().top < window.innerHeight / 1.2) {
      revealElements[i].classList.add("revealed");
    }
  }
}

for (let i = 0, len = revealDelayElements.length; i < len; i++) {
  revealDelayElements[i].style.transitionDelay = revealDelayElements[i].dataset.revealDelay;
}

window.addEventListener("scroll", reveal);
window.addEventListener("load", reveal);
