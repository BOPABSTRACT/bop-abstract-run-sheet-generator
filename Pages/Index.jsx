import { useState, useRef } from 'react';



export default function Home() {

  const [files, setFiles] = useState([]);

  const [abstractorName, setAbstractorName] = useState('');

  const [propertyDescription, setPropertyDescription] = useState('');

  const [processing, setProcessing] = useState(false);

  const [message, setMessage] = useState('');

  const fileInputRef = useRef(null);



  const handleFiles = (newFiles) => {

    setFiles(Array.from(newFiles));

  };



  const handleGenerate = async () => {

    if (!abstractorName || !propertyDescription) {

      setMessage('Please fill in required fields');

      return;

    }



    if (files.length === 0) {

      setMessage('Please select at least one file');

      return;

    }



    setProcessing(true);

    setMessage('Processing documents...');



    try {

      const formData = new FormData();

      files.forEach(file => {

        formData.append('files', file);

      });

      formData.append('abstractorName', abstractorName);

      formData.append('propertyDescription', propertyDescription);



      const response = await fetch('/api/process', {

        method: 'POST',

        body: formData

      });



      const data = await response.json();

      

      if (data.success) {

        setMessage('✅ Run sheet generated successfully!');

      } else {

        setMessage(`Error: ${data.error}`);

      }

    } catch (error) {

      setMessage(`Error: ${error.message}`);

    } finally {

      setProcessing(false);

    }

  };



  return (

    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', fontFamily: 'Arial' }}>

      <h1>Oil & Gas Title Run Sheet Generator</h1>

      

      <div style={{ marginBottom: '20px' }}>

        <label>

          Abstractor Name *

          <input

            type="text"

            value={abstractorName}

            onChange={(e) => setAbstractorName(e.target.value)}

            placeholder="Enter your name"

            style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}

          />

        </label>

      </div>



      <div style={{ marginBottom: '20px' }}>

        <label>

          Property Description *

          <input

            type="text"

            value={propertyDescription}

            onChange={(e) => setPropertyDescription(e.target.value)}

            placeholder="Enter property description"

            style={{ display: 'block', width: '100%', padding: '10px', marginTop: '5px' }}

          />

        </label>

      </div>



      <div style={{ marginBottom: '20px' }}>

        <label>

          Upload Documents

          <input

            ref={fileInputRef}

            type="file"

            multiple

            accept=".pdf"

            onChange={(e) => handleFiles(e.target.files)}

            style={{ display: 'block', marginTop: '5px' }}

          />

        </label>

        <p>Files selected: {files.length}</p>

      </div>



      <button

        onClick={handleGenerate}

        disabled={processing || !abstractorName || !propertyDescription}

        style={{

          padding: '10px 20px',

          backgroundColor: '#0070f3',

          color: 'white',

          border: 'none',

          borderRadius: '5px',

          cursor: 'pointer',

          fontSize: '16px'

        }}

      >

        {processing ? 'Processing...' : 'Generate Run Sheet'}

      </button>



      {message && <p style={{ marginTop: '20px', color: message.includes('Error') ? 'red' : 'green' }}>{message}</p>}

    </div>

  );

}


