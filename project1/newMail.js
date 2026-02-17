// I used google for this part.
const openButton = document.getElementById("openCompose");
const modal = document.getElementById("composeModal");
const closeButton = document.getElementById("closeCompose");
const sendButton = document.getElementById("sendEmail");

openButton.addEventListener("click", function (e) {
    e.preventDefault();
    modal.style.display = "block";
});

closeButton.addEventListener("click", function (e) {
    modal.style.display = "none";
});

window.addEventListener("click", function (e) {
    if (e.target === modal) {
        modal.style.display = "none";
    }
});

let mailCount = 4;

sendButton.addEventListener("click", function () {
    const title = document.getElementById("emailTitle").value;
    const content = document.getElementById("emailContent").value;

    const mailId = "mail" + mailCount;

    const envelope = document.createElement("a");
    envelope.href = "#" + mailId;
    envelope.className = "envelope";
    envelope.style.top = Math.random() * 70 + "%";
    envelope.style.left = Math.random() * 70 + "%";
    envelope.style.animation = "wander 20s ease-in-out infinite";

    document.querySelector(".envelopes")?.appendChild(envelope);


    const mailDiv = document.createElement("div");
    mailDiv.id = mailId;
    mailDiv.className = "mail";

    mailDiv.innerHTML = `
        <div class="mail-window">
            <a href="#" class="close">close</a>
            <h2>${title}</h2>
            <p>${content}</p>
        </div>
    `;

    document.body.appendChild(mailDiv);

    document.getElementById("emailTitle").value = "";
    document.getElementById("emailContent").value = "";
    modal.style.display = "none";
    mailCount++;
});
