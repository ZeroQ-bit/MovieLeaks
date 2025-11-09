import { getMDBListRatings, formatRatingsForDescription } from './mdblist.js';

// Test with Frankenstein which we know has ratings
const testKey = 'xrlgcb0hfaoyk4k7b20w1xv4o';
const testImdb = 'tt1312221'; // Frankenstein

console.log('Testing MDBList integration...');
console.log(`API Key: ${testKey}`);
console.log(`IMDb ID: ${testImdb}`);
console.log('');

getMDBListRatings(testImdb, testKey)
  .then(ratings => {
    console.log('Ratings returned:', JSON.stringify(ratings, null, 2));
    if (ratings) {
      const formatted = formatRatingsForDescription(ratings);
      console.log('');
      console.log('Formatted output:');
      console.log(formatted);
    } else {
      console.log('No ratings returned!');
    }
  })
  .catch(error => {
    console.error('Error:', error);
  });
