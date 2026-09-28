/* SecondLook — a small everyday dictionary used to spot misspellings in messages.
 * It doesn't need to be complete: every score is compared with how YOU usually text,
 * and words you use while sober (names, slang) are learned into your personal vocabulary. */
(function (root) {
  'use strict';
  var WORDS = [
    // everyday English
    'a about above across act actually add after afternoon again against age ago agree ah ahead air all almost alone along',
    'already alright also always am amazing an and angry another answer any anybody anyone anything anyway anywhere apartment',
    'app are area arent arm around arrive arrived as ask asked at ate aunt away awesome awful baby back bad bag bank bar bars',
    'be beach beautiful because bed been beer beers before behind being believe below best better between big bike bill bit',
    'black blue body book boring born both bottle bought box boy brain bread break breakfast bring bro brother brought brown',
    'bus busy but buy by bye cab call called calling calm came can cannot cant car card care careful carry case cash cat catch',
    'cause chair chance change charge charger chat cheap check cheers chill city class clean clear close closed club coat coffee',
    'cold college come comes coming cool corner could couldnt couple course cousin crazy cry cup cut dad damn dance dark date',
    'day days dead deal dear did didnt die different dinner do doctor does doesnt dog doing done dont door double down drink',
    'drinking drinks drive driven driver driving drop dropped drove drunk during each early easy eat eating eight either else',
    'empty end enjoy enough even evening event ever every everybody everyone everything exactly except excited excuse eye eyes',
    'face fact fair fall family far fast feel feeling feet fell felt few fight final find fine finish finished fire first five',
    'floor food foot for forget forgot four free friday friend friends from front full fun funny game games gas gate gave get',
    'gets getting girl girls give given glad glass go god goes going gone gonna good got great green group guess guy guys had',
    'hair half hand hands happen happened happy hard has hasnt hate have havent having he head heading hear heard heart hello',
    'help her here hers hes hey hi high him himself his hit hold home honest honestly hope hot hour hours house how however',
    'huge hungry hurry hurt husband i ice id idea if ill im important in inside instead into is isnt it its itself ive job join',
    'joke just keep keys key kid kids kind kinda kitchen knew know known last late later laugh leave leaving left leg less let',
    'lets life light like line list listen little live lives lol long look looked looking looks lost lot lots loud love low luck',
    'lunch mad made main make makes making man many market matter may maybe me mean means meet meeting met middle might mind',
    'mine minute minutes miss missed mom money month more morning most mother move movie much music must my myself name near',
    'need needs never new news next nice night nine no nobody noise none nor not nothing now number of off office ok okay old',
    'on once one ones only open or order other others our out outside over own pack paid parents park parking part party pass',
    'past pay people person phone pick picked picture place plan play please point police poor pretty probably problem pull',
    'put question quick quickly quiet quite rain rather reach read ready real really reason red remember rest ride right river',
    'road room run safe safely said same saturday saw say says school second see seem seems seen send sent seriously set seven',
    'she shes shit short should shouldnt show shut sick side since single sister sit six sleep slow slowly small smell so some',
    'somebody someone something sometimes somewhere son soon sorry sound speak spend stand start started station stay still',
    'stop store story straight street stuck stuff such sunday super sure take taken taking talk tell ten than thank thanks that',
    'thats the their them then there theres these they theyre thing things think this those though thought three through till',
    'time tired to today together told tomorrow tonight too took top totally town traffic train tried trip true trust try',
    'trying turn two under understand until up upset us use used very wait waiting wake walk walking wall wanna want wanted',
    'wants warm was wasnt watch water way we wear weather week weekend weird well went were werent what whatever whats when',
    'where which while white who whole whose why wife will win window with without woke woman won wont word words work world',
    'worried worry would wouldnt write wrong yeah year years yes yesterday yet you youd youll young your youre yours yourself',
    'youve wed well weve theyll theyve shell hed hell',
    // numbers & time
    'zero eleven twelve fifteen twenty thirty hundred am pm tonight midnight monday tuesday wednesday thursday',
    // night out
    'pub bartender shots shot wine vodka whiskey rum tequila gin cocktail cocktails sober wasted tipsy buzzed hangover snacks',
    'pizza burger fries restaurant hotel hostel flat roommate bestie babe mate buddy dude bruh taxi uber ola rapido auto metro',
    'lyft pickup cab driver keys location address map maps battery dead charger lift',
    // texting
    'brb btw idk ikr imo lmao lmk np omg pls plz rn smh tbh thx ty ur wyd wya hbu ya yea yep yup nah nope kk hmm haha hahaha',
    'lmfao ttyl gn gm fr ngl af bday xoxo cya coz cuz tho yall gotta gotcha sorta dunno lemme gimme outta aint ok okk okay',
    // hinglish
    'haan han nahi nhi kya kyu kyun hai hain kar karo raha rahe rahi ho hoga bhai yaar acha accha achha theek thik chal chalo',
    'kaha kahan ghar main mai tum tu aap abhi bas kal aaj bhi na ki ka ke ko se pe mujhe mera meri tera teri kuch sab bahut',
    'bohot jaldi ruk ruko aaja aao jao pahuch pahunch gaya gayi gaye mat bol bolo sun suno pata nai',
    // names used in the demo
    'alex priya jordan sam mike'
  ].join(' ');

  if (typeof module === 'object' && module.exports) module.exports = WORDS;
  else root.SL_WORDS = WORDS;
})(typeof self !== 'undefined' ? self : this);
