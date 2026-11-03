/**
 * Original, source-backed Grade 2 Unit 1 review.
 * Christ Our Life 2024 Gr 2 teacher guide: Chapter 4 includes Unit 1 review
 * and the Unit 1 assessment after Chapters 1–4.
 * https://lpress-craft-flippingbooks.s3.amazonaws.com/christ-our-life-2024/christ-our-life-2024-te-gr2/index.html
 *
 * These are not publisher/teacher test questions. No student answers,
 * results, photographs or private observations belong in this public file.
 */
export const religionUnitOneFacts = Object.freeze([
  'God made each person in his image and likeness.',
  'The Trinity is one God in three Persons: Father, Son, and Holy Spirit.',
  'The Sign of the Cross begins with the words “In the name of the Father.”',
  'Grace is sharing in God’s own life.',
  'The Holy Spirit guides the Church.',
  'The pope and bishops carry on the mission of the Apostles as Church leaders.',
  'Through Baptism, original sin is washed away and we become members of the Church.',
  'Saints are holy people who loved and served God faithfully and now live with God in heaven.',
]);

const review = (id,skill,chapter,prompt,choices,answer,explanation) => ({
  id:'original-unit1-'+id,
  subject:'Religion',
  skill,
  sourceChapters:[chapter],
  tier:'material',
  questionType:'direct',
  difficulty:2,
  prompt,
  choices,
  answer,
  explanation,
  hint:'Think about the Unit 1 review before choosing your answer.',
  sourceFact:'Original cumulative practice for Christ Our Life Grade 2 Unit 1, Chapters 1–4',
  provenance:'original-abvm-unit1-publisher-aligned',
  sourceMode:'CURATED_CONTEXT',
  supportType:'independent-publisher-support',
});

export const religionUnitOneQuestions = Object.freeze([
  review('church-leaders','religion-unit1-church-leaders',3,
    'Which Church leaders continue the mission that Jesus gave to his Apostles?',
    ['The pope and bishops','Only the church choir','Only the godparents'],
    'The pope and bishops',
    'The pope and bishops lead the Church and carry on the Apostles’ work.'),
  review('apostles','religion-unit1-apostles',3,
    'Whose mission are the pope and bishops continuing?',
    ['The Apostles','The Roman emperors','The school principal'],
    'The Apostles',
    'Jesus chose the Apostles to help lead and teach his Church.'),
  review('sign-cross','religion-unit1-sign-cross',2,
    'Which words come first when Christians make the Sign of the Cross?',
    ['In the name of the Father','Thank you for the food','Peace be with you'],
    'In the name of the Father',
    'The prayer begins by naming the Father, then the Son and Holy Spirit.'),
  review('grace','religion-unit1-grace',3,
    'What word means sharing in the life God gives us?',
    ['grace','a hymn','a holiday'],
    'grace',
    'Grace means a share in God’s very own life.'),
  review('guides-church','religion-unit1-holy-spirit',3,
    'Who gives the Church guidance and helps Christians live as Jesus taught?',
    ['The Holy Spirit','The weather','A television show'],
    'The Holy Spirit',
    'The Holy Spirit guides the Church.'),
  review('saints','religion-unit1-saints',4,
    'What do we call holy people the Church honors who now live with God in heaven?',
    ['saints','tourists','kings'],
    'saints',
    'Saints are people who followed and loved God in extraordinary ways.'),
  review('original-sin','religion-unit1-original-sin',3,
    'What does Baptism wash away as it welcomes us into God’s Church?',
    ['original sin','all homework','all future responsibilities'],
    'original sin',
    'Baptism washes away original sin, connected with Adam and Eve.'),
]);
