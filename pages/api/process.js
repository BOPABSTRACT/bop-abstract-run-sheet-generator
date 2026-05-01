<!DOCTYPE html>

<html>

<head>

<title>Run Sheet Generator</title>

<style>

body { font-family: Arial; background: #f0f0f0; padding: 20px; }

.container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }

h1 { color: #333; }

label { display: block; margin: 15px 0 5px 0; font-weight: bold; }

input[type="text"], input[type="file"] { width: 100%; padding: 8px; margin-bottom: 10px; border: 1px solid #ddd; border-radius: 4px; }

button { width: 100%; padding: 10px; background: #0070f3; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }

button:hover { background: #0051cc; }

#message { margin-top: 15px; padding: 10px; border-radius: 4px; }

.success { background: #d4edda; color: #155724; }

.error { background: #f8d7da; color: #721c24; }

</style>

</head>

<body>

<div class="container">

<h1>Oil & Gas Title Run Sheet Generator</h1>

<label>Abstractor Name *</label>

<input type="text" id="abstractorName" placeholder="Enter your name">

<label>Property Description *</label>

<input type="text" id="propertyDesc" placeholder="Enter property description">

<label>Upload PDF Documents</label>

<input type="file" id="fileInput" multiple accept=".pdf">

<button onclick="generateRunSheet()">Generate Run Sheet</button>

<div id="message"></div>

</div>



<script>

async function generateRunSheet() {

  const abstractorName = document.getElementById('abstractorName').value;

  const propertyDesc = document.getElementById('propertyDesc').value;

  const fileInput = document.getElementById('fileInput');

  const messageDiv = document.getElementById('message');

  

  if (!abstractorName || !propertyDesc) {

    messageDiv.innerHTML = 'Please fill in all required fields';

    messageDiv.className = 'error';

    return;

  }

  

  if (fileInput.files.length === 0) {

    messageDiv.innerHTML = 'Please select at least one PDF file';

    messageDiv.className = 'error';

    return;

  }

  

  messageDiv.innerHTML = 'Processing documents...';

  messageDiv.className = '';

  

  try {

    const formData = new FormData();

    for (let file of fileInput.files) {

      formData.append('files', file);

    }

    formData.append('abstractorName', abstractorName);

    formData.append('propertyDesc', propertyDesc);

    

    const response = await fetch('/api/process', {

      method: 'POST',

      body: formData

    });

    

    const data = await response.json();

    

    if (data.success) {

      messageDiv.innerHTML = '✓ Run sheet generated successfully!';

      messageDiv.className = 'success';

    } else {

      messageDiv.innerHTML = 'Error: ' + (data.error || 'Unknown error');

      messageDiv.className = 'error';

    }

  } catch (error) {

    messageDiv.innerHTML = 'Error: ' + error.message;

    messageDiv.className = 'error';

  }

}

</script>

</body>

</html>

