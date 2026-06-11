const form = document.getElementById("prediction-form");

if (form) {
  form.addEventListener("submit", (event) => {
    const invalidInput = [...form.querySelectorAll("input[required]")].find(
      (input) => input.value === ""
    );
    if (invalidInput) {
      event.preventDefault();
      invalidInput.focus();
      alert("Please fill out all required health parameters.");
    }
  });
}
