document.addEventListener("DOMContentLoaded", function() {
  // Elements
  const searchInput = document.getElementById('search');
  const searchButton = document.getElementById('search-btn');
  const resultsContainer = document.getElementById('results');
  const modal = document.getElementById('verse-modal');
  const closeModal = document.querySelector('.close');

  // Collapsible sections functionality (if any exist)
  const collapsibles = document.querySelectorAll('.collapsible');
  collapsibles.forEach(collapsible => {
    collapsible.addEventListener('click', function() {
      this.classList.toggle("active");
      const content = this.nextElementSibling;
      if (content.style.display === "block") {
        content.style.display = "none";
      } else {
        content.style.display = "block";
      }
    });
  });

  // Basic search functionality: Display a dummy result based on the query
  searchButton.addEventListener('click', function() {
    const query = searchInput.value.trim();
    if (query !== "") {
      // For demonstration, we create a dummy result
      resultsContainer.innerHTML = `<div class="result-item">Result for "${query}"</div>`;
    }
  });

  // Open modal on clicking a result item to show verse details
  resultsContainer.addEventListener('click', function(event) {
    if (event.target && event.target.classList.contains('result-item')) {
      modal.style.display = "block";
      document.getElementById('verse-modal-title').textContent = "Verse Title";
      document.getElementById('verse-modal-text').textContent = "This is a sample verse text.";
    }
  });

  // Close modal when the close button is clicked
  closeModal.addEventListener('click', function() {
    modal.style.display = "none";
  });

  // Close modal when clicking outside the modal content
  window.addEventListener('click', function(event) {
    if (event.target === modal) {
      modal.style.display = "none";
    }
  });
});
