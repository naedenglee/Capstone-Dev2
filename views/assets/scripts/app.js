const sign_in_btn = document.querySelector('#sign-in-button');
const sign_up_btn = document.querySelector('#sign-up-button');
const container = document.querySelector('.container');

sign_up_btn.addEventListener('click', ()=>{
    container.classList.add('sign-up-mode');
} );

sign_in_btn.addEventListener('click', ()=>{
    container.classList.remove('sign-up-mode');
} );


// date picker//
   

$(function() {
  $('input[name="daterange"]').daterangepicker({
    opens: 'left'
  }, function(start, end, label) {
    console.log("date: " + start.format('YYYY-MM-DD') + ' to ' + end.format('YYYY-MM-DD'));
  });
});

// homepage.html// 
//LOGIN----------//
// Get the modal
var modal = document.getElementById('id01');

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
  if (event.target == modal) {
      modal.style.display = "none";
  }
}

//SIGN UP -----------//

// Get the modal
var modal = document.getElementById('id02');

// When the user clicks anywhere outside of the modal, close it
window.onclick = function(event) {
if (event.target == modal) {
  modal.style.display = "none";
}
}

