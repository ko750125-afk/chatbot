export interface Message {
  role: 'user' | 'model';
  parts: [{ text: string }];
}

export const sendMessage = async (message: string, history: Message[], pdfContext: string = "", useSearch: boolean = false) => {
  try {
    const response = await fetch('http://localhost:8000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        history,
        pdf_context: pdfContext,
        use_search: useSearch
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Network response was not ok');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const uploadPdf = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch('http://localhost:8000/api/upload-pdf', {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Upload failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error uploading PDF:', error);
    throw error;
  }
};

export const summarizePdf = async (pdfContext: string) => {
  try {
    const response = await fetch('http://localhost:8000/api/summarize', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pdf_context: pdfContext,
        language: "ko"
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.detail || 'Summarization failed');
    }

    return await response.json();
  } catch (error) {
    console.error('Error summarizing PDF:', error);
    throw error;
  }
};
