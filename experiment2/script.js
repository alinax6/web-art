let cup = document.createElement('div');
cup.id = 'newCup';
cup.className = 'cup';
document.body.appendChild(cup);

let message = document.createElement('div');
message.className = 'message';
document.body.appendChild(message);

message.textContent = "Click the cup to refill your water";
let cupElement = document.getElementById('newCup');



// document.getElementById('newCup').addEventListener("click", function() {
//     cup.classList.toggle("filled");
// })

cupElement.addEventListener("click", function() {
    cupElement.classList.toggle("filled");

    if (cup.classList.contains("filled")) {
        message.textContent = "Cup filled! Stay hydrated!";
    }
    else {
        message.textContent = "Cup emptied! Click to refill again";
    }
});


