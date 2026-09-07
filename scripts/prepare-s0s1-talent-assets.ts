import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const oldRoot = path.join(root, "refs/Exports/NZM/Content_S1");
const currentRoot = path.join(root, "refs/Exports/NZM/Content");
const output = path.join(root, "public/webp/images/season-talents/s0s1");
const local = path.join(root, "MD/_local/s0s1Talent");
const list = (dir: string) => fs.readdirSync(dir, { recursive: true }).map(String);
const oldFiles = list(oldRoot).filter((f) => f.endsWith(".png"));
const currentFiles = list(currentRoot);
const oldByName = new Map(oldFiles.map((f) => [path.basename(f, ".png"), path.join(oldRoot, f)]));
const currentByName = new Map(currentFiles.filter(f => f.endsWith(".png")).map((f) => [path.basename(f, ".png"), path.join(currentRoot, f)]));

async function sheet() {
  const files = oldFiles.filter(f => /TalentCandleTomb.*SP.*(Bg|De|Icon)|SeasonalTalent_Bg|SeasonalTalent_Icon|SeasonalTalent_SP_(Bg|De)/.test(f));
  const tiles: sharp.OverlayOptions[] = [];
  for (const [index, file] of files.entries()) {
    const thumb = await sharp(path.join(oldRoot, file)).resize(260, 145, {fit:"contain", background:"#23262b"}).png().toBuffer();
    const label = path.basename(file).replace("T_TalentCandleTomb_SP_", "S1_").replace("T_SeasonalTalent_", "S0_");
    const caption = Buffer.from(`<svg width="260" height="30"><text x="5" y="19" fill="white" font-size="11">${index}: ${label}</text></svg>`);
    const left = index % 5 * 260, top = Math.floor(index / 5) * 175;
    tiles.push({input:thumb,left,top},{input:caption,left,top:top+145});
  }
  fs.mkdirSync(local, {recursive:true});
  await sharp({create:{width:1300,height:Math.ceil(files.length/5)*175,channels:3,background:"#23262b"}}).composite(tiles).jpeg().toFile(path.join(local,"assets.jpg"));
}

async function convert() {
  fs.mkdirSync(output, {recursive:true});
  const basic = JSON.parse(fs.readFileSync(path.join(currentRoot,"DataTables/SeasonTalent/SeasonTalentBasicTable.json"),"utf8"))[0].Rows;
  const types = JSON.parse(fs.readFileSync(path.join(currentRoot,"DataTables/SeasonTalent/SeasonTalentTypeTable.json"),"utf8"))[0].Rows;
  type Row = {SeasonID:number;SeasonPhaseID:number;TalentIcon?:{AssetPathName:string};TypeIcon?:{AssetPathName:string}};
  const references = [...Object.values(basic), ...Object.values(types)] as Row[];
  const names = new Set(references.filter(r=>r.SeasonID===1 && r.SeasonPhaseID<=1).map(r=>(r.TalentIcon??r.TypeIcon)!.AssetPathName.split(".")[0].split("/").pop()!));
  for (const f of oldFiles.filter(f => /TalentCandleTomb.*SP.*(Bg|De|Icon)|SeasonalTalent_Bg|SeasonalTalent_Icon|SeasonalTalent_SP_Bg/.test(f))) names.add(path.basename(f,".png"));
  names.add("T_SeasonalTalent_SP_De_16");
  const evidence: {name:string;source:string;crop?:unknown;missing?:boolean}[]=[];
  for (const name of names) {
    const direct = oldByName.get(name) ?? currentByName.get(name);
    if (direct) {
      await sharp(direct).resize({width:2560,withoutEnlargement:true}).webp({quality:88}).toFile(path.join(output,`${name}.webp`));
      evidence.push({name,source:path.relative(root,direct)});
      continue;
    }
    const spriteFile = currentFiles.find(f => path.basename(f)===`${name}.json`);
    const sprite = spriteFile && JSON.parse(fs.readFileSync(path.join(currentRoot,spriteFile),"utf8")).find((v:{Type:string})=>v.Type==="PaperSprite");
    const props = sprite?.Properties;
    const textureName = props?.BakedSourceTexture?.ObjectPath?.split(".")[0].split("/").pop();
    const textureRelative = props?.BakedSourceTexture?.ObjectPath?.split(".")[0].replace(/^NZM\/Content\//, "") + ".png";
    const exactTexture = path.join(oldRoot, textureRelative);
    const texture = fs.existsSync(exactTexture) ? exactTexture : oldByName.get(textureName) ?? currentByName.get(textureName);
    if (texture && props?.BakedSourceUV && props?.BakedSourceDimension) {
      const crop={left:props.BakedSourceUV.X,top:props.BakedSourceUV.Y,width:props.BakedSourceDimension.X,height:props.BakedSourceDimension.Y};
      const meta=await sharp(texture).metadata();
      if(crop.left+crop.width<=meta.width! && crop.top+crop.height<=meta.height!) {
        await sharp(texture).extract(crop).webp({quality:92}).toFile(path.join(output,`${name}.webp`));
        evidence.push({name,source:path.relative(root,texture),crop});
        continue;
      }
    }
    // Some current references retain an atlas prefix after the texture was unpacked.
    const unprefixed=name.replace(/^T_Talent_\d+_\d+_/,"T_");
    const fallback=oldByName.get(unprefixed)??currentByName.get(unprefixed);
    if(fallback) {
      await sharp(fallback).webp({quality:92}).toFile(path.join(output,`${name}.webp`));
      evidence.push({name,source:path.relative(root,fallback)});
    } else evidence.push({name,source:spriteFile??"",missing:true});
  }
  fs.mkdirSync(local,{recursive:true});
  fs.writeFileSync(path.join(local,"asset-evidence.json"),JSON.stringify(evidence,null,2)+"\n");
  console.log(JSON.stringify({exported:evidence.filter(e=>!e.missing).length,missing:evidence.filter(e=>e.missing)},null,2));
}

void (process.argv.includes("--sheet") ? sheet() : convert());
