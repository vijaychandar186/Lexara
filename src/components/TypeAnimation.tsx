'use client';

import { TypeAnimation } from 'react-type-animation';
import React from 'react';

const TypeAnimationComponent: React.FC = () => {
  return (
    <TypeAnimation
      sequence={[
        'Upload your PDFs.', // Types this
        1500, // Waits 1.5s
        'Make them searchable.', // Deletes the previous text and types this
        2000, // Waits 2s
        'Sign up now!', // Deletes the previous text and types this
        1500, // Waits 2s
        'Start your OCR journey today.', // Deletes the previous text and types this
        2500, // Waits 2.5s
        () => {
          console.log('OCR sequence completed');
        },
      ]}
      wrapper="span"
      cursor={true}
      repeat={Infinity}
      style={{ fontSize: '2em', display: 'inline-block', color: '#1D4ED8' }} // You can customize the style as needed
    />
  );
};

export default TypeAnimationComponent;