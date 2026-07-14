document.addEventListener("DOMContentLoaded", () => {


    const form = document.getElementById("loginForm");

    const password = document.getElementById("password");

    const toggle = document.querySelector(".togglePassword");


    // Show / hide password

    toggle.addEventListener("click", () => {


        if(password.type === "password"){

            password.type = "text";
            toggle.textContent = "🙈";

        } else {

            password.type = "password";
            toggle.textContent = "👁";

        }


    });



    // Frontend validation only

    form.addEventListener("submit", (e) => {


        const username = document.getElementById("username");


        if(username.value.trim() === ""){

            e.preventDefault();

            alert("Please enter your username.");

            username.focus();

            return;

        }


        if(password.value.trim() === ""){

            e.preventDefault();

            alert("Please enter your password.");

            password.focus();

            return;

        }


        // DO NOT use e.preventDefault() here
        // Let PHP handle login

    });


});