const form = document.getElementById("form");

form.addEventListener("submit", function(e){

    e.preventDefault();

    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirm = document.getElementById("confirm").value;

    if(username === ""){
        alert("Please enter a username.");
        return;
    }

    if(username.length < 3){
        alert("Username must be at least 3 characters.");
        return;
    }

    if(!/^[a-zA-Z0-9_]+$/.test(username)){
        alert("Username can only contain letters, numbers and _");
        return;
    }

    if(email === ""){
        alert("Please enter your email.");
        return;
    }

    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){
        alert("Please enter a valid email address.");
        return;
    }

    if(password.length < 8){
        alert("Password must be at least 8 characters.");
        return;
    }

    if(!/[A-Z]/.test(password)){
        alert("Password must contain at least one uppercase letter.");
        return;
    }

    if(!/[a-z]/.test(password)){
        alert("Password must contain at least one lowercase letter.");
        return;
    }

    if(!/[0-9]/.test(password)){
        alert("Password must contain at least one number.");
        return;
    }

    if(!/[!@#$%^&*(),.?\":{}|<>]/.test(password)){
        alert("Password must contain at least one special character.");
        return;
    }

    if(password !== confirm){
        alert("Passwords do not match.");
        return;
    }

    form.submit();

});