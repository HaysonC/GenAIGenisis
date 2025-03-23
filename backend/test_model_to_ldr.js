const ModelToLDR = require('./ModelToLDR.js');

async function testConversion() {
  try {
    const modelToLdr = new ModelToLDR();
    console.log('ModelToLDR instance created');
    
    const inputFile = 'models/A_single__ripe__yellow_banana__1742705647167.obj';
    const outputFile = 'ldr_output/banana_from_js.ldr';
    const resolution = 64;
    
    console.log(`Converting file: ${inputFile} to ${outputFile} with resolution ${resolution}`);
    
    const result = await modelToLdr.convertOBJToLDR(inputFile, outputFile, resolution);
    console.log('Conversion result:', result);
  } catch (error) {
    console.error('Error during conversion:', error);
  }
}

testConversion(); 