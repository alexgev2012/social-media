<?php

session_start();

require_once "includes/database.php";

$error = "";


if($_SERVER["REQUEST_METHOD"] === "POST"){


    $username = trim($_POST["username"]);
    $password = $_POST["password"];


    if(empty($username) || empty($password)){


        $error = "Please fill in all fields.";


    } else {


        $stmt = $conn->prepare(
            "SELECT id, username, firstname, lastname, password, status
             FROM users
             WHERE username = ?"
        );


        $stmt->bind_param(
            "s",
            $username
        );


        $stmt->execute();


        $result = $stmt->get_result();



        if($result->num_rows === 1){


            $user = $result->fetch_assoc();



            if(password_verify($password, $user["password"])) {



                $_SESSION["user_id"] = $user["id"];
                $_SESSION["username"] = $user["username"];
                $_SESSION["firstname"] = $user["firstname"];
                $_SESSION["lastname"] = $user["lastname"];



                header("Location: home.php");
                exit;



            } else {


                $error = "Incorrect password.";


            }



        } else {


            $error = "Username not found.";


        }


        $stmt->close();


    }


}

?>

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>Sign In</title>

    <link rel="stylesheet" href="assets/auth.css">
</head>
<body>

<div class="container">

    <div class="auth-header">
        <h1>Welcome Back</h1>
        <p>Sign in to continue.</p>
    </div>

    <?php if($error): ?>

<div class="auth-alert error-alert">

    <div class="alert-icon">
        ⚠️
    </div>

    <div class="alert-content">

        <strong>Login failed</strong>

        <span>
            <?= htmlspecialchars($error); ?>
        </span>

    </div>

</div>

<?php endif; ?> 
    <form id="loginForm" method="POST" autocomplete="off" novalidate>

        <!-- Username / Email -->
<div class="inputBox">

    <label for="username">Username</label>

    <input
        type="text"
        id="username"
        name="username"
        placeholder="Enter your username"
        autocomplete="username"
        required
    >

    <small class="error"></small>

</div>

        <!-- Password -->
        <div class="inputBox">

            <label for="password">Password</label>

            <div class="passwordBox">

                <input
                    type="password"
                    id="password"
                    name="password"
                    placeholder="Enter your password"
                    required
                >

                <button
                    type="button"
                    class="togglePassword"
                    data-target="password"
                    aria-label="Show password">
                    👁
                </button>

            </div>

            <small class="error"></small>

        </div>

        <!-- Remember Me -->

        <div class="rememberBox">

            <label>

                <input
                    type="checkbox"
                    name="remember"
                    id="remember"
                >

                Remember me

            </label>
            <br>
            
        </div>
        
        <button
        type="submit"
        class="submitBtn"
        id="loginBtn">
        
        Sign In
        
    </button>
    
    <a href="forgot-password.php">
        Forgot password?
    </a>
</form>

    <div class="login">

        Don't have an account?

        <a href="register.php">
            Create one
        </a>

    </div>

</div>

<script src="assets/login.js"></script>

</body>
</html>