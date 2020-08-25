const myForm = document.getElementById("myForm");

myForm.addEventListener("submit", async(event) => {
    event.preventDefault();

    let data = new URLSearchParams(new FormData(manualForm));
    let response = await fetch("/", {
        method: "post",
        body: data,
    });
    let result = await response.text();
    document.getElementById("response").value = result;
});