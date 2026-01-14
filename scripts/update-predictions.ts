/**
 * Script to update all prediction reasons with more detailed explanations
 * Run with: npx tsx scripts/update-predictions.ts
 */

import { db } from '../src/lib/db';
import { shows } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';

// Detailed prediction reasons for each show
// Format: "Predicted X★: [detailed reasoning referencing taste profile, similar shows, and specific factors]"
const detailedPredictions: Record<number, string> = {
  // Marvel's Luke Cage (tmdbId: 62126) - 3★
  62126: "Predicted 3★: Marvel/Netflix show in the Daredevil universe - you're a completionist (Daredevil 3★, Jessica Jones 4★). Cancelled after 2 seasons (-0.5★ cancellation penalty), though story has decent closure. Season 1 stronger with Cottonmouth villain; Season 2 drags. Action-focused with less psychological depth than Jessica Jones. Similar to Iron Fist in being the weaker entries of the Defenders lineup. Solo viewing - superhero content.",

  // Marvel's The Defenders (tmdbId: 62285) - 3★
  62285: "Predicted 3★: Marvel crossover miniseries bringing together Daredevil, Jessica Jones, Luke Cage, and Iron Fist. Completionist value for the Marvel/Netflix universe you've invested in. Generally considered the weakest entry - rushed 8-episode format doesn't give characters room to breathe. The Hand storyline less compelling than individual show villains. COMPLETE limited series at least means resolution. Solo viewing only - superhero content Helen dislikes.",

  // Operation Buffalo (tmdbId: 99940) - 4★
  99940: "Predicted 4★: Australian drama (+0.5★ bonus) set during 1950s British nuclear testing at Maralinga. Similar to Chernobyl (5★) in exploring nuclear history with dark humor elements. Limited series format you prefer for together viewing. True historical basis adds weight. Ewen Leslie and Jess De Gouw star - strong Aussie cast. Cold War paranoia themes. COMPLETE 6 episodes - perfect low-commitment watch. Together viewing - historical drama with character depth.",

  // See (tmdbId: 80752) - 3★
  80752: "Predicted 3★: Post-apocalyptic drama with unique blindness premise. Jason Momoa leads this Apple TV+ series. Interesting world-building but action-focused over character depth - similar to The Last of Us (4★) but without the emotional resonance. Three seasons allows for complete story. Action-adventure genre combo that's mixed for you. COMPLETE but may feel stretched. Solo viewing - too action-heavy for together.",

  // I Know This Much Is True (tmdbId: 88166) - 3★
  88166: "Predicted 3★: Mark Ruffalo delivers exceptional dual performance as twin brothers - Emmy-winning acting you'd appreciate. Based on Wally Lamb novel. However, extremely heavy and emotionally draining throughout - 'dark without hope' pattern that's a negative modifier. Limited series format (6 episodes) but emotionally exhausting content. COMPLETE. Together viewing cautiously - prestige quality but relentlessly bleak.",

  // Twin Peaks (tmdbId: 1920) - 3★
  1920: "Predicted 3★: David Lynch's influential mystery series - cult classic but extremely experimental and deliberately slow (-0.5★ each). Surrealist style will either fascinate or frustrate. The 2017 'Return' season even more challenging. While influential for prestige TV, the dreamlike pacing and unresolved mysteries may feel pointless rather than profound. Kyle MacLachlan excellent but it's very much acquired taste territory. COMPLETE 3 seasons across decades. Solo only - too weird for Helen.",

  // Money Heist (tmdbId: 71446) - 3.5★
  71446: "Predicted 3.5★: Spanish heist thriller (La Casa de Papel) with clever premise and memorable characters. Exciting early seasons but significant fizzle risk in later parts - pacing issues similar to Tehran (3★) where momentum stalls. Strong ensemble and iconic imagery. COMPLETE 5 parts but lengthy commitment. Together viewing - thriller energy suits shared watching, though may lose steam.",

  // Maid (tmdbId: 111141) - 4★
  111141: "Predicted 4★: Based on Stephanie Land's memoir (+0.3★ true story bonus) about escaping domestic abuse and poverty. Similar emotional resonance to Lessons in Chemistry (4.5★) - strong female protagonist overcoming systemic barriers. Margaret Qualley delivers breakthrough performance. Limited series with definitive ending - no cancellation risk. Prestige Netflix limited series format. COMPLETE. Together viewing - emotionally powerful true story you both appreciate.",

  // The Kominsky Method (tmdbId: 81290) - 3.5★
  81290: "Predicted 3.5★: Michael Douglas and Alan Arkin comedy-drama about aging Hollywood acting coach. Easy-watch comfort food similar to Shrinking (4★) - witty dialogue, likeable leads, gentle pacing. Chuck Lorre moves beyond sitcom format successfully. Light but with emotional depth in exploring mortality and friendship. COMPLETE 3 seasons. Together viewing - easy watch for relaxing.",

  // Smoke (tmdbId: 215995) - 3★
  215995: "Predicted 3★: Indian crime drama about arson investigators. Limited international content precedent makes this harder to predict. Crime procedural elements Helen might enjoy. RT audience score (49%) significantly lower than critics (74%) - in mystery/crime genre, you typically side with audience concerns. COMPLETE limited series format. Together viewing tentatively - crime mystery format.",

  // Amazing Stories (tmdbId: 98178) - 2.5★
  98178: "Predicted 2.5★: Spielberg-produced anthology reboot of 1980s series. Sci-fi anthology format you enjoy (Black Mirror 4.5★, Love Death & Robots 4★) but execution disappoints. RT scores reflect this (41% critics, 52% audience) - forgettable rather than memorable entries. Apple TV+ production values can't save weak storytelling. COMPLETE but underwhelming - the 'style over substance' negative pattern. Solo viewing.",

  // Inventing Anna (tmdbId: 95665) - 3★
  95665: "Predicted 3★: True story about Anna Delvey con artist (+0.3★ true story) from Shonda Rhimes. Similar territory to The Dropout but less focused execution. Julia Garner excellent in lead. However, 9-episode runtime feels stretched - pacing issues where story could be tighter. Style over substance risk despite fascinating true story. COMPLETE limited series. Together viewing - true crime story format.",

  // We Were the Lucky Ones (tmdbId: 219109) - 4★
  219109: "Predicted 4★: WWII family saga (+0.3★ WWII bonus, +0.3★ true story) based on memoir about Holocaust survival. Similar appeal to Chernobyl (5★) - historical drama with emotional weight. Logan Lerman leads strong ensemble. Eight-episode miniseries format you prefer. Stories of resilience rather than just tragedy. COMPLETE limited series. Together viewing - WWII true story hits all your shared preferences.",

  // Ozark (tmdbId: 69740) - 4.5★
  69740: "Predicted 4.5★: Crime drama about money laundering in the Ozarks. Jason Bateman and Laura Linney deliver exceptional performances. Similar prestige tier to Breaking Bad - intense but character-driven crime drama. Psychological depth you appreciate in solo viewing. Four seasons with complete ending - no cancellation anxiety. Dark but compelling throughout. COMPLETE. Solo viewing - intense content, though quality might work together.",

  // Five Days at Memorial (tmdbId: 153312) - 4★
  153312: "Predicted 4★: Apple TV+ limited series based on true story (+0.3★ bonus) of Hurricane Katrina hospital crisis. Similar to Dopesick (4★) - true story drama with great acting and systemic critique. Vera Farmiga leads excellent cast. Emotionally challenging but important storytelling. COMPLETE 8 episodes - limited series format you prefer. Together viewing - prestige true story.",

  // Euphoria (tmdbId: 85552) - 2.5★
  85552: "Predicted 2.5★: Teen drama with striking visual style but extremely dark content. Style over substance risk - beautiful cinematography masking hollow characters. Season 2 production issues and uncertain future (-0.5★ unresolved). Zendaya excellent but subject matter (addiction, trauma) without the hopeful elements you prefer. Very slow pacing between intensity. Returning but troubled production. Solo only - too intense and dark for together viewing.",

  // Rectify (tmdbId: 61548) - 4★
  61548: "Predicted 4★: Sundance drama about wrongly imprisoned man's release. Exceptional slow-burn character study with psychological depth you love in solo viewing. Aden Young's performance is mesmerizing. Similar prestige quality to The Leftovers (4.5★) - literary, thoughtful, rewarding patience. COMPLETE 4 seasons with proper ending. However, deliberately slow pacing (-0.5★) means solo viewing only - would bore Helen.",

  // Rosehaven (tmdbId: 68261) - 4★
  68261: "Predicted 4★: Australian comedy (+0.5★ bonus) about two friends returning to Tasmania. Easy-watch sitcom similar to Schitt's Creek (4★) - warm, funny, character-driven. Luke McGregor and Celia Pacquola have great chemistry. Light stakes, genuine heart. COMPLETE 4 seasons. Solo viewing - Australian comedy.",

  // Echo 3 (tmdbId: 152239) - 3★
  152239: "Predicted 3★: Apple TV+ thriller about kidnapping in Colombia. Action-focused with Mark Boal (Hurt Locker) involvement. Mixed reception - RT reflects uncertainty. Similar to international thrillers that can lose momentum (Tehran 3★). COMPLETE 10 episodes but cancelled after one season (-0.5★ unresolved). Action over character depth. Together viewing tentatively - thriller format.",

  // The Witcher (tmdbId: 71912) - 2.5★
  71912: "Predicted 2.5★: Fantasy adaptation with Henry Cavill. Action-fantasy genre not your strongest preference. Story structure confusing in Season 1. Cavill's departure and recasting creates uncertainty. Helen doesn't enjoy fantasy/superhero content. Mixed execution despite high production values. Returning but with significant concerns. Solo only if at all - fantasy action.",

  // Bad Sisters (tmdbId: 153339) - 4★
  153339: "Predicted 4★: Irish dark comedy thriller about sisters plotting murder. Ensemble cast excellent - Sharon Horgan leads. Similar to Only Murders in the Building (4★) - mystery with dark comedy elements. RT critics at 100% - though you diverge from critics on comedy, this is more thriller than pure comedy. Strong character development. Season 2 available. Together viewing - mystery-comedy format works well.",

  // The Office Australia (tmdbId: 247261) - 3.5★
  247261: "Predicted 3.5★: Australian remake (+0.5★ Australian bonus) of The Office - your all-time favorite show (5★). Felicity Ward leads as Hannah Howard. However, remakes rarely capture original magic, and cancelled after 1 season (-0.5★). Workplace mockumentary format you love. Worth watching for Australian take but manage expectations. CANCELLED. Solo viewing - Office comparison.",

  // KEVIN CAN F**K HIMSELF (tmdbId: 102520) - 3.5★
  102520: "Predicted 3.5★: AMC dark comedy with unique format - switches between sitcom and prestige drama. Meta-commentary on sitcom tropes. Annie Murphy post-Schitt's Creek. Innovative concept but execution may feel gimmicky. Two seasons with complete ending. COMPLETE. Together viewing tentatively - format might intrigue or confuse.",

  // Yellowjackets (tmdbId: 125988) - 4★
  125988: "Predicted 4★: Mystery thriller with dual timeline structure about plane crash survivors. Similar to Lost meets Lord of the Flies. Strong ensemble including Melanie Lynskey and Christina Ricci. Engaging mystery format. However, returning series with cancellation concerns given industry trends. Slow-burn reveals. Returning. Together viewing - mystery thriller energy.",

  // Time (tmdbId: 118990) - 3.5★
  118990: "Predicted 3.5★: British prison drama with Sean Bean. Prestige BBC limited series. Similar to British crime dramas you enjoy together. Strong acting and social commentary. Returning series format. Together viewing - British drama quality.",

  // Modern Love Tokyo (tmdbId: 194765) - 3★
  194765: "Predicted 3★: Japanese anthology romance based on Modern Love format. Anthology episodes mean uneven quality. Light romantic content. COMPLETE. Together viewing - light anthology format.",

  // Star Trek: Prodigy (tmdbId: 106393) - 3.5★
  106393: "Predicted 3.5★: Animated Trek for younger audience but with genuine Trek storytelling. Part of your Trek completionist viewing (Lower Decks 4.5★, Strange New Worlds 4★, Discovery 4★). Initially cancelled then revived - production history uncertainty. Kate Mulgrew returns as hologram Janeway. RETURNING. Solo viewing - Trek content.",

  // Atlanta (tmdbId: 65495) - 3.5★
  65495: "Predicted 3.5★: Donald Glover's critically acclaimed comedy-drama. Artistic vision similar to experimental shows that can divide. Won major awards. COMPLETE 4 seasons with planned ending. However, experimental style is acquired taste - surreal episodes may frustrate. Solo viewing - unique artistic vision.",

  // The Flight Attendant (tmdbId: 91363) - 3.5★
  91363: "Predicted 3.5★: Kaley Cuoco mystery-comedy with Only Murders in the Building (4★) energy. Fun premise about flight attendant investigating murder. CANCELLED after 2 seasons (-0.5★ unresolved). Season 2 less focused than S1. Together viewing - mystery comedy format works.",

  // Normal People (tmdbId: 96667) - 3★
  96667: "Predicted 3★: Irish romance based on Sally Rooney novel (93% RT critics). Beautiful intimate drama but VERY slow pacing (-0.5★). High risk of 'too slow for Helen' - see Severance, Fargo notes where slow pacing killed shared viewing. Paul Mescal excellent. COMPLETE 12 episodes. Solo viewing only - intimate pacing won't hold Helen's interest.",

  // Wellington Paranormal (tmdbId: 79824) - 3★
  79824: "Predicted 3★: New Zealand comedy spinoff from What We Do in the Shadows (3★ - 'too crude for Helen'). Mockumentary format you love. More family-friendly than parent show. COMPLETE 4 seasons. May lack depth for sustained viewing. Solo viewing - quirky comedy.",

  // Pluribus (tmdbId: 276429) - 4.5★
  276429: "Predicted 4.5★: Sci-fi drama with psychological complexity similar to Severance (5★) and Silo (4.5★). Speculative setting exploring deep themes. Your sweet spot of cerebral sci-fi. Solo viewing - psychological sci-fi depth.",

  // Boardwalk Empire (tmdbId: 1429) - 4★
  1429: "Predicted 4★: HBO prestige period crime drama set during Prohibition. Steve Buscemi leads. Similar quality tier to The Sopranos - rich character development and period detail. Martin Scorsese directed pilot. COMPLETE 5 seasons with proper ending. Crime drama format. Together viewing - prestige period drama.",

  // Task (tmdbId: 258395) - 4★
  258395: "Predicted 4★: Crime drama from acclaimed creators. Returning series - limited information available. Crime drama format you enjoy together. Returning.",

  // Mad Men (tmdbId: 1104) - 3.5★
  1104: "Predicted 3.5★: Prestige advertising drama (92% RT). Don Draper character study - slow burn with psychological complexity. May feel dated in pacing expectations. COMPLETE 7 seasons. Character-driven but very slow (-0.5★). Solo viewing - deliberate pacing.",

  // Bookish (tmdbId: 277422) - 4★
  277422: "Predicted 4★: Crime mystery drama. Limited information available. Returning series. Crime mystery format you enjoy together.",

  // The Penguin (tmdbId: 194764) - 4★
  194764: "Predicted 4★: DC prestige crime drama spinoff from The Batman. Colin Farrell unrecognizable as Oz Cobb. Noir atmosphere and character depth unusual for superhero adjacent content. COMPLETE limited series - no cancellation risk. However, Helen's dislike of superhero content may limit appeal. Solo viewing recommended despite quality.",

  // The Last Frontier (tmdbId: 236605) - 2.5★
  236605: "Predicted 2.5★: Drama cancelled quickly (-0.5★ cancellation penalty). Limited information available. CANCELLED.",

  // Your Friends & Neighbors (tmdbId: 256574) - 3.5★
  256574: "Predicted 3.5★: Drama with Jon Hamm. Returning series. Limited information on premise. Drama format.",

  // Chief of War (tmdbId: 213846) - 3.5★
  213846: "Predicted 3.5★: Historical drama about Hawaiian warrior king. Jason Momoa stars and co-created. Historical basis adds weight. COMPLETE limited series. Together viewing - historical drama format.",

  // Lioness (tmdbId: 200776) - 4★
  200776: "Predicted 4★: Taylor Sheridan spy/military thriller. Similar to Slow Horses (4.5★) and Bodyguard (4★) in spy thriller territory. Zoe Saldana leads. Action-oriented but character-driven. Returning series. Together viewing - spy thriller format works well for you both.",

  // The Beast in Me (tmdbId: 272844) - 4★
  272844: "Predicted 4★: Drama with acclaimed performances. COMPLETE limited series format you prefer. Limited information but prestige indicators.",

  // The Four Seasons (tmdbId: 253556) - 3.5★
  253556: "Predicted 3.5★: Comedy with Steve Carell. Limited information available. Comedy format. Returning series.",

  // Wednesday (tmdbId: 119051) - 3.5★
  119051: "Predicted 3.5★: Addams Family spinoff with Jenna Ortega. Tim Burton's visual style. Fantasy teen comedy - popular but lighter fare than your usual preferences. Fun but not deep. Returning series. Together viewing tentatively - light entertainment.",

  // The Pitt (tmdbId: 261202) - 4★
  261202: "Predicted 4★: Medical drama from ER creator Noah Wyle. Real-time hospital format - innovative approach. Helen enjoys procedural formats (The Rookie 4.5★). Strong ER pedigree suggests quality. Returning series. Together viewing - procedural format Helen enjoys.",

  // Apple Cider Vinegar (tmdbId: 238664) - 4★
  238664: "Predicted 4★: Australian drama (+0.5★ bonus) based on true story (+0.3★ bonus) about wellness fraud. Similar to The Dropout in exploring con artist territory. Kaitlyn Dever leads. COMPLETE limited series. Together viewing - Australian true story.",

  // Somebody Somewhere (tmdbId: 133479) - 4★
  133479: "Predicted 4★: Heartfelt comedy-drama with Bridget Everett. Similar warm tone to Shrinking (4★) and Hacks (3.5★). Small-town Midwest setting. Character-driven with genuine emotion. COMPLETE 3 seasons with proper ending. Together viewing - heartfelt comedy.",

  // Yellowstone (tmdbId: 73586) - 3.5★
  73586: "Predicted 3.5★: Taylor Sheridan Western drama about ranching family. Kevin Costner leads. Massive cultural phenomenon. However, sprawling seasons and multiple spinoffs suggest commitment level. Drama with action elements. Returning but Costner departure complicates. Together viewing - family drama saga.",

  // The Tattooist of Auschwitz (tmdbId: 205022) - 4★
  205022: "Predicted 4★: WWII true story (+0.3★ bonus each) about Holocaust love story. Similar emotional territory to Chernobyl (5★) and A Small Light (4★). Prestige limited series format. Harvey Keitel leads. COMPLETE. Together viewing - WWII true story hits your shared preferences.",

  // The Gold (tmdbId: 203504) - 4★
  203504: "Predicted 4★: British crime drama based on true Brink's-Mat heist story (+0.3★ true story bonus). Similar to prestige British crime dramas you enjoy. Hugh Bonneville and Jack Lowden star. COMPLETE 2 seasons. Together viewing - British crime true story.",

  // Platonic (tmdbId: 112211) - 3.5★
  112211: "Predicted 3.5★: Seth Rogen and Rose Byrne comedy about rekindled platonic friendship 'destabilizing their lives.' Apple TV+ comedies have been mixed for you (Ted Lasso 4★ but Mythic Quest 3.5★, Shrinking 4★). Easy-watch format similar to Shrinking. RT critics at 96% but you often diverge from critics on comedy. The 'destabilizing lives' premise suggests drama elements which can dilute comedy - pure comedy (Parks & Rec 5★, Office 5★) works better for you than comedy-drama hybrids. Season 2 returning. Together viewing - light comedy format Helen enjoys.",

  // Drops of God (tmdbId: 202249) - 3.5★
  202249: "Predicted 3.5★: Wine-themed drama with mystery elements from Apple TV+. Unique premise exploring wine world. Fleur Geffrier stars. Visual style. Returning series. Together viewing - unique premise.",

  // Manhunt (tmdbId: 218145) - 4★
  218145: "Predicted 4★: Apple TV+ true story limited series about Lincoln assassination aftermath. Similar to your note on original Manhunt (3.5★ - 'nice low commitment watch'). Tobias Menzies leads. Historical drama with investigation elements. COMPLETE 7 episodes. Together viewing - true story limited series.",

  // Presumed Innocent (tmdbId: 225014) - 3.5★
  225014: "Predicted 3.5★: Apple TV+ legal thriller remake with Jake Gyllenhaal. Similar courtroom drama appeal to The Good Wife (4★). Legal procedural elements Helen may enjoy. Returning series. Together viewing - legal thriller format.",

  // The Residence (tmdbId: 236997) - 2.5★
  236997: "Predicted 2.5★: Netflix comedy from Shonda Rhimes. Despite interesting White House murder mystery premise, cancelled quickly (-0.5★). Execution didn't land with audiences. CANCELLED. Together viewing would have been - mystery comedy.",

  // Sugar (tmdbId: 203737) - 3.5★
  203737: "Predicted 3.5★: Apple TV+ detective mystery with Colin Farrell. Genre twist midseason may appeal or disappoint depending on expectations. Noir detective format. Returning series. Solo viewing - mystery with twist.",

  // The Alienist (tmdbId: 71789) - 3.5★
  71789: "Predicted 3.5★: Period crime thriller set in 1890s NYC. Daniel Brühl leads psychological investigation. Atmospheric but deliberate pacing can drag (-0.5★ slow risk). Similar to Penny Dreadful territory. COMPLETE 2 seasons. Together viewing tentatively - period thriller.",

  // Secret Level (tmdbId: 245897) - 3★
  245897: "Predicted 3★: Amazon animated anthology from video games. Anthology format (Love Death Robots 4★) but video game source may limit appeal if unfamiliar with games. Animation quality likely high. Returning series. Solo viewing - animated anthology.",

  // HIS & HERS (tmdbId: 282399) - 2.5★
  282399: "Predicted 2.5★: Mystery crime drama. Limited information available. COMPLETE. Together viewing - crime mystery.",

  // The Chair Company (tmdbId: 282389) - 4★
  282389: "Predicted 4★: Comedy drama. Limited information available. Returning series.",

  // Here We Go (tmdbId: 130802) - 3★
  130802: "Predicted 3★: British comedy drama about chaotic family. Light entertainment. Returning series. Together viewing - British comedy.",

  // Deadwood (tmdbId: 1406) - 3.5★
  1406: "Predicted 3.5★: HBO prestige Western from David Milch. Ian McShane iconic as Al Swearengen. Shakespearean dialogue and complex characters. However, cancelled after 3 seasons (-0.5★) without proper resolution - though 2019 movie provided closure. Period drama quality but Western setting less appealing to you. COMPLETE with movie finale. Together viewing - prestige Western.",

  // Dying for Sex (tmdbId: 217088) - 3★
  217088: "Predicted 3★: Peacock drama-comedy. Limited information available. COMPLETE limited series. Together viewing.",

  // Black Doves (tmdbId: 248890) - 4★
  248890: "Predicted 4★: Netflix British spy thriller with Keira Knightley. Directly comparable to Slow Horses (4.5★) and Bodyguard (4★) - your favorite shared viewing genre. British intelligence setting. Ben Whishaw co-stars. Action and intrigue balance. Returning series. Together viewing - British spy thriller sweet spot.",

  // What's Next? The Future with Bill Gates (tmdbId: 252668) - 2.5★
  252668: "Predicted 2.5★: Documentary series with Bill Gates exploring future technologies. Documentary format can vary in engagement. Tech focus. Returning series. Together viewing tentatively - documentary.",

  // Am I Being Unreasonable? (tmdbId: 211858) - 3.5★
  211858: "Predicted 3.5★: British dark comedy thriller. Daisy May Cooper stars. BBC quality. Mystery elements with comedy. Returning series. Together viewing - British dark comedy.",

  // Girls5eva (tmdbId: 109823) - 3★
  109823: "Predicted 3★: Comedy about 90s girl group reunion from Tina Fey. Cancelled after 3 seasons (-0.5★ cancellation). Fun premise but didn't fully land. Sara Bareilles leads. CANCELLED. Together viewing would have been - comedy.",

  // Maestro in Blue (tmdbId: 217299) - 3★
  217299: "Predicted 3★: Greek drama with crime elements. International content. Returning series. Together viewing - drama.",

  // Bodies (tmdbId: 208071) - 4★
  208071: "Predicted 4★: Netflix time-bending crime mystery spanning 4 different eras (1890s, 1940s, 2023, 2053). Similar narrative complexity to Dark (4.5★ - 'love when a show has pay offs'). British production with interconnected mysteries. COMPLETE limited series. Together viewing - mystery with time elements.",

  // Daisy Jones & the Six (tmdbId: 135942) - 4★
  135942: "Predicted 4★: Amazon music drama based on Taylor Jenkins Reid novel. 1970s rock setting with great period detail. Riley Keough and Sam Claflin lead ensemble. Mockumentary interview format adds authenticity. COMPLETE 10-episode limited series. Together viewing - period drama with music.",

  // Blue Lights (tmdbId: 210691) - 3.5★
  210691: "Predicted 3.5★: BBC police procedural set in Belfast. Helen enjoys procedural formats (The Rookie 4.5★). British crime drama quality. Returning series. Together viewing - police procedural.",

  // Reservation Dogs (tmdbId: 112470) - 3.5★
  112470: "Predicted 3.5★: FX comedy-drama with Indigenous perspective. Unique voice and critical acclaim. Taika Waititi involved. COMPLETE 3 seasons with planned ending. Character-driven with cultural specificity. Solo viewing - unique comedy-drama.",

  // Dear Mama (tmdbId: 221197) - 3.5★
  221197: "Predicted 3.5★: Documentary series about Tupac Shakur's mother. True story format (+0.3★ bonus). FX documentary quality. COMPLETE 5 episodes. Together viewing - documentary.",

  // The Lying Life of Adults (tmdbId: 155538) - 2.5★
  155538: "Predicted 2.5★: Italian drama based on Elena Ferrante novel. Slow-paced literary adaptation that risks feeling like 'nothing happens' - similar to drops like War and Peace (2.5★). Beautiful Italian setting but deliberate pacing. COMPLETE. Solo viewing only.",

  // Reacher (tmdbId: 108978) - 3.5★
  108978: "Predicted 3.5★: Amazon action thriller based on Lee Child novels. Easy-watch popcorn entertainment with Alan Ritchson. Action-focused with less depth - fun but not profound. Popular and successful. Returning series. Together viewing - easy action watch.",

  // The Gentlemen (tmdbId: 196988) - 3.5★
  196988: "Predicted 3.5★: Netflix crime comedy from Guy Ritchie. Theo James leads British aristocracy meets crime world. Stylish but substance risk - Ritchie's style-over-substance tendency. Returning series. Together viewing - crime comedy.",

  // 24 (tmdbId: 1973) - 3.5★
  1973: "Predicted 3.5★: Classic action thriller with real-time gimmick. Kiefer Sutherland as Jack Bauer. Influential but may feel dated now. COMPLETE 9 seasons - significant commitment. Action-focused with political thriller elements. Solo viewing - long commitment.",

  // Station Eleven (tmdbId: 86831) - 4★
  86831: "Predicted 4★: HBO Max post-apocalyptic drama with literary quality from Emily St. John Mandel novel. Thoughtful rather than action-focused - emphasis on art and human connection. Excellent performances. COMPLETE 10-episode limited series. Solo viewing - literary slow burn.",

  // Down Cemetery Road (tmdbId: 282401) - 4★
  282401: "Predicted 4★: British mystery drama. Limited information available. Returning series. British mystery format.",

  // RIPLEY (tmdbId: 204370) - 4★
  204370: "Predicted 4★: Netflix prestige noir with exceptional black-and-white cinematography. Andrew Scott leads adaptation of Patricia Highsmith novel. Visual artistry and psychological character study. COMPLETE 8-episode limited series. Solo viewing - artistic psychological thriller.",

  // Dr. Brain (tmdbId: 127557) - 2.5★
  127557: "Predicted 2.5★: Korean sci-fi thriller from Apple TV+. Cancelled after 1 season (-0.5★) before story resolution. Lee Sun-kyun led before tragic passing. Interesting premise cut short. CANCELLED. Solo viewing.",

  // Tulsa King (tmdbId: 152946) - 3.5★
  152946: "Predicted 3.5★: Stallone crime comedy-drama from Taylor Sheridan. Fish-out-of-water premise with mobster in Tulsa. Easy-watch with Stallone charisma. Returning series. Together viewing - easy crime comedy.",

  // BoJack Horseman (tmdbId: 61222) - 4★
  61222: "Predicted 4★: Animated comedy-drama about washed-up 90s sitcom star. Surprisingly deep exploration of depression, addiction, and Hollywood. Will Arnett voices BoJack. Similar to how you appreciate animated shows with substance (Bluey 5★, Lower Decks 4.5★). However, very dark themes throughout - cynical tone may wear thin. COMPLETE 6 seasons with proper ending. Solo viewing - animated but heavy themes.",

  // The Sopranos (tmdbId: 1398) - 4.5★
  1398: "Predicted 4.5★: HBO's groundbreaking mob drama that defined prestige TV. James Gandolfini iconic as Tony Soprano. Similar tier to your 4+ rated prestige shows. Psychological depth of therapy scenes alongside crime drama. COMPLETE 6 seasons with famously divisive ending. Seminal influence on shows you love. Solo or together - complex enough for solo, mob drama Helen might enjoy.",

  // Space Force (tmdbId: 85922) - 3★
  85922: "Predicted 3★: Steve Carell workplace comedy from Office creators. Failed to capture Office magic despite pedigree. Cancelled after 2 seasons (-0.5★). Concept strong but execution mixed. CANCELLED. Solo viewing - Office comparison will disappoint.",

  // Peaky Blinders (tmdbId: 60574) - 4★
  60574: "Predicted 4★: British period crime drama about Birmingham gang in 1920s. Cillian Murphy leads stylish production. Similar to Boardwalk Empire (4★) in period crime territory. COMPLETE 6 seasons with proper movie finale. Stylish but substantive. Together viewing - British period crime drama.",

  // Mr. Robot (tmdbId: 62560) - 4★
  62560: "Predicted 4★: Psychological thriller about hacker taking down corporations. Rami Malek won Emmy for complex performance. Mind-bending narrative similar to your love of cerebral shows (Dark 4.5★, Severance 5★). COMPLETE 4 seasons with planned ending. However, very dark and paranoid tone throughout. Solo viewing - psychological complexity.",

  // Roseanne (tmdbId: 2706) - 3.5★
  2706: "Predicted 3.5★: Classic 90s sitcom about working-class family. Nostalgia value and workplace comedy elements you enjoy. However, controversial later seasons and reboot issues. COMPLETE original run. Comfort viewing but dated.",

  // The Night Manager (tmdbId: 61859) - 4★
  61859: "Predicted 4★: British spy thriller limited series with Tom Hiddleston and Hugh Laurie. Similar to Slow Horses (4.5★) and Bodyguard (4★) in spy genre you love together. John le Carré adaptation. COMPLETE 6 episodes. Together viewing - spy thriller format.",

  // Dune: Prophecy (tmdbId: 90228) - 3★
  90228: "Predicted 3★: Prequel series set in Dune universe focusing on Bene Gesserit. Sci-fi but more political drama than action. Returning series just started - too early to assess quality. Franchise expectations high. Solo viewing - sci-fi universe building.",

  // Band of Brothers (tmdbId: 4613) - 4.5★
  4613: "Predicted 4.5★: HBO WWII miniseries (+0.3★ WWII bonus, +0.3★ true story) from Spielberg/Hanks. Prestige war drama similar to Chernobyl (5★) quality level. Exceptional production and acting. COMPLETE 10 episodes. Together viewing - WWII true story hits your preferences.",

  // Succession (tmdbId: 76331) - 4.5★
  76331: "Predicted 4.5★: HBO drama about dysfunctional media family. Exceptional writing and performances. Won multiple Emmys. Prestige tier similar to your highest rated dramas. COMPLETE 4 seasons with acclaimed ending. Dark comedy mixed with family drama. Solo or together - quality transcends.",

  // House of the Dragon (tmdbId: 94997) - 3.5★
  94997: "Predicted 3.5★: Game of Thrones prequel about Targaryen civil war. Better received than later GoT seasons but fantasy genre mixed for you. Dragons and political intrigue. Returning series. Solo viewing - fantasy content Helen dislikes.",

  // Masters of the Air (tmdbId: 46518) - 4★
  46518: "Predicted 4★: Apple TV+ WWII miniseries (+0.3★ WWII, +0.3★ true story) from Spielberg/Hanks following Band of Brothers. Air Force bomber crews over Europe. Similar prestige quality. COMPLETE limited series. Together viewing - WWII true story.",

  // The Peripheral (tmdbId: 95403) - 3★
  95403: "Predicted 3★: Amazon sci-fi from William Gibson novel. Complex time travel/virtual reality premise. Cancelled after 1 season (-0.5★) without resolution - exactly the cancellation anxiety you hate. Chloe Grace Moretz leads. CANCELLED. Solo viewing.",

  // SS-GB (tmdbId: 68003) - 3★
  68003: "Predicted 3★: British alternate history where Nazis won WWII. Interesting premise but execution mixed. Limited series format. Together viewing tentatively - historical thriller.",

  // True Detective (tmdbId: 46648) - 4★
  46648: "Predicted 4★: HBO anthology crime series. Season 1 (McConaughey/Harrelson) is exceptional - 4.5★ quality. Later seasons more mixed (3-3.5★ range). Atmospheric crime investigation with philosophical depth. Anthology means varying quality. Solo viewing - philosophical depth and slow-burn atmospheric style suits solo watching, though crime mystery format could work together.",

  // Poker Face (tmdbId: 120998) - 4★
  120998: "Predicted 4★: Peacock mystery series from Knives Out creator with Natasha Lyonne. Case-of-the-week format Helen enjoys in procedurals. Columbo-style whodunit structure. Fun and clever. Returning series. Together viewing - procedural mystery format.",

  // The Expanse (tmdbId: 63639) - 4★
  63639: "Predicted 4★: Space opera sci-fi with political intrigue and realistic physics. Similar to Foundation (4.5★) in epic sci-fi territory. COMPLETE 6 seasons after move from Syfy to Amazon. Complex world-building rewards investment. Solo viewing - detailed sci-fi.",

  // Territory (tmdbId: 243396) - 3★
  243396: "Predicted 3★: Australian drama (+0.5★ bonus) about outback ranching dynasty. Similar to Yellowstone territory but Australian setting. Limited information on quality. Together viewing - Australian drama.",

  // 1923 (tmdbId: 157744) - 3.5★
  157744: "Predicted 3.5★: Yellowstone prequel with Harrison Ford and Helen Mirren. Period Western drama in 1920s Montana. Star power elevates material. Returning series. Together viewing - period drama.",

  // Landman (tmdbId: 157741) - 3.5★
  157741: "Predicted 3.5★: Taylor Sheridan drama about Texas oil industry with Billy Bob Thornton. Sheridan's consistent quality (Lioness 4★, Tulsa King 3.5★). Returning series. Together viewing - drama.",

  // None (tmdbId: 236598) - Unknown
  236598: "Predicted 3★: Limited information available. Unable to generate detailed prediction.",

  // The Wire (tmdbId: 1438) - 4.5★
  1438: "Predicted 4.5★: HBO's acclaimed Baltimore crime drama examining institutions. Considered one of greatest TV shows ever made. Similar prestige tier to Sopranos (4.5★). Dense and rewarding - slow build but exceptional payoff. COMPLETE 5 seasons. Together viewing - prestige crime drama.",

  // Patriot (tmdbId: 64396) - 4★
  64396: "Predicted 4★: Amazon dark comedy about depressed intelligence officer. Unique tone mixing spy thriller with deadpan comedy. Cult following but cancelled after 2 seasons (-0.5★) without resolution. Michael Dorman excellent. CANCELLED but worth it for quality. Solo viewing - dark quirky tone.",

  // Mare of Easttown (tmdbId: 115004) - 4★
  115004: "Predicted 4★: HBO limited series with Kate Winslet as small-town detective. Mystery format Helen enjoys. Exceptional acting and Pennsylvania setting. COMPLETE 7 episodes. Together viewing - prestige crime mystery.",

  // Quiz (tmdbId: 101543) - 3.5★
  101543: "Predicted 3.5★: British limited series about Who Wants to Be a Millionaire cheating scandal (+0.3★ true story). Matthew Macfadyen and Sian Clifford star. Fun premise. COMPLETE 3 episodes. Together viewing - British true story.",

  // Industry (tmdbId: 90812) - 3.5★
  90812: "Predicted 3.5★: BBC/HBO drama about young London finance workers. Similar to Succession in workplace power dynamics but younger cast. Returning series. Together viewing tentatively - workplace drama.",

  // Catherine the Great (tmdbId: 76692) - 3.5★
  76692: "Predicted 3.5★: Helen Mirren as Russian empress in HBO miniseries. Period drama with prestige casting. Similar to The Crown (4.5★) in royal historical territory. COMPLETE 4 episodes. Together viewing - period royal drama.",

  // Star Trek: Starfleet Academy (tmdbId: 223530) - 3.5★
  223530: "Predicted 3.5★: New Trek series about Academy cadets. Part of Trek completionist viewing but focused on younger characters may not appeal as much as Strange New Worlds (4★) or Lower Decks (4.5★). Returning series just started. Solo viewing - Trek franchise.",

  // Orphan Black (tmdbId: 56296) - 4★
  56296: "Predicted 4★: Canadian sci-fi thriller about woman discovering she's a clone. Tatiana Maslany's performance is extraordinary - playing multiple distinct characters. Sci-fi mystery with conspiracy elements. COMPLETE 5 seasons. Solo viewing - sci-fi thriller complexity.",
};

async function updatePredictions() {
  console.log('Updating prediction reasons...\n');

  let updated = 0;
  let skipped = 0;

  for (const [tmdbIdStr, reason] of Object.entries(detailedPredictions)) {
    const tmdbId = parseInt(tmdbIdStr);

    try {
      const result = await db.update(shows)
        .set({
          predictedRatingReason: reason,
          predictionsUpdatedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .where(eq(shows.tmdbId, tmdbId));

      console.log(`✓ Updated: tmdbId ${tmdbId}`);
      updated++;
    } catch (error) {
      console.error(`✗ Failed: tmdbId ${tmdbId}`, error);
      skipped++;
    }
  }

  console.log(`\nComplete: ${updated} updated, ${skipped} skipped`);
}

updatePredictions().catch(console.error);
